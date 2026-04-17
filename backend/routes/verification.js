
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

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
const { analyzePose } = require('../utils/faceVerifier');

// ─── POST /api/verification/analyze-frame ────────────────────────────────────
// Lightweight liveness helper — accepts a low-quality selfie frame and returns
// estimated head yaw angle + smile score derived from 68-point landmarks.
// Used by the mobile app camera screen for real-time liveness detection.
const uploadFrame = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB max (low-quality frame)
});

router.post('/analyze-frame', protect, uploadFrame.fields([
  { name: 'frame', maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files;
    if (!files?.frame?.[0]) {
      return res.status(400).json({ success: false, message: 'frame image required' });
    }
    const result = await analyzePose(files.frame[0].buffer);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[analyze-frame] Error:', err.message);
    // Return a safe fallback so the app never hard-crashes
    return res.json({ success: true, faceDetected: false, yawAngle: 0, smileScore: 0 });
  }
});

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
      submittedAt: new Date(),
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

// ─── POST /me/verify-face ─────────────────────────────────────────────────────
// Mobile-user endpoint.  Accepts a live selfie, compares it to the user's
// first profile photo, and returns { verified, similarity }.
// If similarity ≥ 0.85 the user record is updated immediately.
router.post('/me/verify-face', protect, upload.fields([
  { name: 'photo', maxCount: 1 },
]), async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('name photos verified verificationStatus selfiePhoto');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.verified && user.verificationStatus === 'approved') {
      return res.json({ success: true, verified: true, similarity: 1, alreadyVerified: true });
    }

    const files = req.files;
    if (!files?.photo?.[0]) {
      return res.status(400).json({ success: false, message: 'Photo is required' });
    }

    const profilePhotoUrl =
      user.photos?.[0]?.url ||
      (typeof user.photos?.[0] === 'string' ? user.photos[0] : null);

    if (!profilePhotoUrl) {
      return res.status(422).json({ success: false, message: 'Please add a profile photo first.' });
    }

    const { compareFaces } = require('../utils/faceVerifier');
    const result = await compareFaces(files.photo[0].buffer, profilePhotoUrl, 0.85);

    if (result.verified) {
      // Upload selfie to Cloudinary and record it
      let selfieUrl = null;
      try {
        const selfieResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'afroconnect_verifications/selfies' },
            (error, r) => (error ? reject(error) : resolve(r))
          );
          stream.end(files.photo[0].buffer);
        });
        selfieUrl = selfieResult.secure_url;
      } catch (_) {}

      await User.findByIdAndUpdate(req.user._id, {
        verified: true,
        verificationStatus: 'approved',
        verificationApprovedAt: new Date(),
        verificationRejectionReason: null,
        ...(selfieUrl ? {
          selfiePhoto: { url: selfieUrl, submittedAt: new Date() },
        } : {}),
      });

      try {
        const io = req.app.get('io');
        if (io) io.to(req.user._id.toString()).emit('user:verified', {
          userId: req.user._id.toString(), verified: true, verificationStatus: 'approved',
        });
      } catch (_) {}
    }

    return res.json({
      success:    true,
      verified:   result.verified,
      similarity: result.similarity,
      liveness:   result.liveness,
      ...(result.error ? { reason: result.error } : {}),
    });
  } catch (error) {
    console.error('[me/verify-face] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
});

// ─── POST /verify-face/by-url ─────────────────────────────────────────────────
// Admin-facing: compare user's stored selfie URL vs profile photo.
// Body: { userId }  (no file upload — uses selfie already on record)
router.post('/verify-face/by-url', protect, isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const user = await User.findById(userId).select('name photos selfiePhoto verified verificationStatus');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const profilePhotoUrl =
      user.photos?.[0]?.url ||
      (typeof user.photos?.[0] === 'string' ? user.photos[0] : null);

    const selfieUrl =
      user.selfiePhoto?.url ||
      (typeof user.selfiePhoto === 'string' ? user.selfiePhoto : null);

    if (!profilePhotoUrl) {
      return res.status(422).json({ success: false, message: 'User has no profile photo' });
    }
    if (!selfieUrl) {
      return res.status(422).json({ success: false, message: 'User has no selfie on record' });
    }

    // Fetch selfie into a buffer
    const { default: nodeFetch } = await import('node-fetch').catch(() => ({ default: null }));
    let selfieBuffer;
    if (nodeFetch) {
      const resp = await nodeFetch(selfieUrl, { timeout: 15000 });
      selfieBuffer = Buffer.from(await resp.arrayBuffer());
    } else {
      // Fallback: native https/http fetch
      const https = require('https');
      const http  = require('http');
      const { URL } = require('url');
      selfieBuffer = await new Promise((resolve, reject) => {
        const parsed  = new URL(selfieUrl);
        const client  = parsed.protocol === 'https:' ? https : http;
        const chunks  = [];
        const req2    = client.get(selfieUrl, (r) => {
          r.on('data', (c) => chunks.push(c));
          r.on('end',  () => resolve(Buffer.concat(chunks)));
        });
        req2.on('error', reject);
        req2.setTimeout(15000, () => { req2.destroy(); reject(new Error('Timeout')); });
      });
    }

    const { compareFaces } = require('../utils/faceVerifier');
    const result = await compareFaces(selfieBuffer, profilePhotoUrl, 0.85);

    if (result.verified) {
      await User.findByIdAndUpdate(userId, {
        verified: true,
        verificationStatus: 'approved',
        verificationApprovedAt: new Date(),
        verificationApprovedBy: req.user._id,
        verificationRejectionReason: null,
      });
      try {
        const io = req.app.get('io');
        if (io) io.to(userId).emit('user:verified', { userId, verified: true, verificationStatus: 'approved' });
      } catch (_) {}
    }

    return res.json({
      success:    true,
      verified:   result.verified,
      similarity: result.similarity,
      distance:   result.distance,
      liveness:   result.liveness,
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (error) {
    console.error('[verify-face/by-url] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Face verification failed', error: error.message });
  }
});

// ─── POST /verify-face ────────────────────────────────────────────────────────
// Automated face verification + liveness check.
// Accepts:  multipart/form-data  { image: File, userId: string }
// Returns:  { success, verified, similarity, liveness, error? }
// Requires: admin token
router.post('/verify-face', protect, isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Selfie image is required' });
    }

    const user = await User.findById(userId).select('name photos selfiePhoto verified verificationStatus');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Resolve profile photo URL
    const profilePhotoUrl =
      user.photos?.[0]?.url ||
      (typeof user.photos?.[0] === 'string' ? user.photos[0] : null);

    if (!profilePhotoUrl) {
      return res.status(422).json({
        success: false,
        message: 'User has no profile photo to compare against',
      });
    }

    // Resolve selfie URL (from user record or use the uploaded image directly)
    const selfieUrl =
      user.selfiePhoto?.url ||
      (typeof user.selfiePhoto === 'string' ? user.selfiePhoto : null);

    // Use uploaded image buffer for the live selfie comparison
    const selfieBuffer = req.file.buffer;

    const { compareFaces } = require('../utils/faceVerifier');
    const result = await compareFaces(selfieBuffer, profilePhotoUrl, 0.85);

    // Update user record when verification passes
    if (result.verified) {
      await User.findByIdAndUpdate(userId, {
        verified: true,
        verificationStatus: 'approved',
        verificationApprovedAt: new Date(),
        verificationApprovedBy: req.user._id,
        verificationRejectionReason: null,
      });

      // Real-time socket push
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(userId).emit('user:verified', {
            userId,
            verified: true,
            verificationStatus: 'approved',
          });
        }
      } catch (_) {}
    }

    return res.json({
      success:    true,
      verified:   result.verified,
      similarity: result.similarity,
      distance:   result.distance,
      liveness:   result.liveness,
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (error) {
    console.error('[verify-face] Error:', error.message);
    return res.status(500).json({
      success:  false,
      message:  'Face verification failed',
      error:    error.message,
    });
  }
});

module.exports = router;
