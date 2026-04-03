
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const upload = multer({ storage: multer.memoryStorage() });

// Admin auth middleware
const isAdmin = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

const emailService = require('../utils/emailService');

// Submit verification request with selfie photo only
router.post('/request', protect, upload.fields([
  { name: 'selfiePhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.verified && user.verificationStatus === 'approved') {
      return res.status(400).json({ success: false, message: 'Already verified' });
    }

    const files = req.files;
    if (!files || !files.selfiePhoto || !files.selfiePhoto[0]) {
      return res.status(400).json({ success: false, message: 'Selfie photo required' });
    }

    // Upload selfie to Cloudinary
    const selfieResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'afroconnect_verifications/selfies' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(files.selfiePhoto[0].buffer);
    });

    user.verificationStatus = 'pending';
    user.selfiePhoto = {
      url: selfieResult.secure_url,
      publicId: selfieResult.public_id,
      submittedAt: new Date()
    };
    user.verificationRequestDate = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Verification request submitted',
      status: 'pending'
    });
  } catch (error) {
    console.error('Verification request error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// Check verification status
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('verified verificationStatus verificationRequestDate verificationApprovedAt verificationRejectionReason');
    
    res.json({
      success: true,
      data: {
        verified: user.verified || false,
        status: user.verificationStatus || 'not_requested',
        requestDate: user.verificationRequestDate || null,
        approvedAt: user.verificationApprovedAt || null,
        rejectionReason: user.verificationRejectionReason || null
      }
    });
  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN: Get pending verifications with full profile access
router.get('/pending', protect, isAdmin, async (req, res) => {
  try {
    const verifications = await User.find({ 
      verificationStatus: 'pending'
    }).select('_id name email age gender bio photos selfiePhoto verificationRequestDate livingIn jobTitle interests');

    res.json({
      success: true,
      verifications
    });
  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN: Approve verification
router.put('/:userId/approve', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.verified = true;
    user.verificationStatus = 'approved';
    user.verificationApprovedBy = req.user._id;
    user.verificationApprovedAt = new Date();
    user.verificationRejectionReason = null;
    await user.save();

    // Send verification approved email
    try {
      const { sendVerificationApprovedEmail } = require('../utils/emailService');
      await sendVerificationApprovedEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Failed to send verification approved email:', emailError);
    }

    // Real-time push: instantly update the user's verified badge on their device
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(user._id.toString()).emit('user:verified', {
          userId: user._id.toString(),
          verified: true,
          verificationStatus: 'approved',
        });
      }
    } catch (socketError) {
      console.error('Failed to emit verification socket event:', socketError);
    }

    res.json({
      success: true,
      message: 'User verified successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        verified: true
      }
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN: Reject verification
router.put('/:userId/reject', protect, isAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.verificationStatus = 'rejected';
    user.verificationRejectionReason = reason || 'Photos do not meet requirements';
    user.verificationApprovedAt = null;
    await user.save();

    // Send rejection email
    try {
      const { sendVerificationRejectedEmail } = require('../utils/emailService');
      await sendVerificationRejectedEmail(user.email, user.name, reason);
    } catch (emailError) {
      console.error('Failed to send verification rejection email:', emailError);
    }

    res.json({
      success: true,
      message: 'Verification rejected',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        status: 'rejected'
      }
    });
  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
