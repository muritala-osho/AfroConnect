
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const VIDEO_UPLOAD_DIR = path.join(__dirname, '..', 'public', 'verification-videos');

const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      await fs.promises.mkdir(VIDEO_UPLOAD_DIR, { recursive: true });
      cb(null, VIDEO_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = file.mimetype === 'video/quicktime' ? 'mov' : 'mp4';
      cb(null, `${req.user?._id || 'unknown'}-${Date.now()}.${ext}`);
    },
  }),
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith('video/')) {
      return cb(new Error('Video file required'));
    }
    cb(null, true);
  },
});

const isAdmin = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ─── POST /upload-verification-video ────────────────────────────────────────
const handleVerificationVideoUpload = async (req, res) => {
  const tempPath = req.file?.path || null;
  try {
    const requestedUserId     = req.body.userId;
    const authenticatedUserId = req.user._id.toString();
    const userId              = requestedUserId || authenticatedUserId;

    if (requestedUserId && requestedUserId !== authenticatedUserId && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Cannot upload verification for another user' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Video file required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let videoUrl = null;
    let publicId = null;
    let storage  = 'local';

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const uploaded = await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(tempPath);
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'afroconnect_verifications/videos', resource_type: 'video' },
            (error, result) => (error ? reject(error) : resolve(result))
          );
          readStream.pipe(stream);
        });
        videoUrl = uploaded.secure_url;
        publicId = uploaded.public_id;
        storage  = 'cloudinary';
        // Remove temp file after successful Cloudinary upload
        fs.unlink(tempPath, () => {});
      } catch (cloudError) {
        console.error('[upload-verification-video] Cloudinary upload failed:', cloudError.message);
      }
    }

    if (!videoUrl) {
      // Keep the file on disk — serve it locally
      const fileName = path.basename(tempPath);
      videoUrl = `/public/verification-videos/${fileName}`;
      storage  = 'local';
    }

    user.verificationStatus           = 'pending';
    user.verificationVideoUrl         = videoUrl;
    user.verificationVideo            = { url: videoUrl, publicId, storedAt: new Date(), storage };
    user.verificationRequestDate      = new Date();
    user.verificationRejectionReason  = null;
    await user.save();

    return res.json({
      success:  true,
      message:  'Verification video uploaded successfully',
      status:   'pending',
      videoUrl,
    });
  } catch (error) {
    console.error('[upload-verification-video] Error:', error.message);
    if (tempPath) fs.unlink(tempPath, () => {});
    return res.status(500).json({ success: false, message: 'Verification video upload failed' });
  }
};

const handleMulterError = (err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Video file is too large. Maximum size is 300 MB.' });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message || 'Upload error' });
  }
  next();
};

router.post(
  '/upload-verification-video',
  protect,
  (req, res, next) => uploadVideo.single('video')(req, res, (err) => handleMulterError(err, req, res, next)),
  handleVerificationVideoUpload
);

// ─── GET /status ─────────────────────────────────────────────────────────────
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('verified verificationStatus verificationRequestDate verificationApprovedAt verificationRejectionReason');
    res.json({
      success: true,
      data: {
        verified:         user.verified || false,
        status:           user.verificationStatus || 'not_requested',
        requestDate:      user.verificationRequestDate || null,
        approvedAt:       user.verificationApprovedAt || null,
        rejectionReason:  user.verificationRejectionReason || null,
      },
    });
  } catch (error) {
    console.error('Verification status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── ADMIN: Get pending verifications ────────────────────────────────────────
router.get('/pending', protect, isAdmin, async (req, res) => {
  try {
    const verifications = await User.find({ verificationStatus: 'pending' })
      .select('_id name email age gender bio photos verificationVideoUrl verificationVideo verificationRequestDate livingIn jobTitle interests');
    res.json({ success: true, verifications });
  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── ADMIN: Approve verification ─────────────────────────────────────────────
router.put('/:userId/approve', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.verified                    = true;
    user.verificationStatus          = 'approved';
    user.verificationApprovedBy      = req.user._id;
    user.verificationApprovedAt      = new Date();
    user.verificationRejectionReason = null;
    await user.save();

    try {
      const { sendVerificationApprovedEmail } = require('../utils/emailService');
      await sendVerificationApprovedEmail(user.email, user.name);
    } catch (emailError) {
      console.error('Failed to send verification approved email:', emailError);
    }

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
      user: { _id: user._id, name: user.name, email: user.email, verified: true },
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── ADMIN: Reject verification ──────────────────────────────────────────────
router.put('/:userId/reject', protect, isAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.verificationStatus          = 'rejected';
    user.verificationRejectionReason = reason || 'Video does not meet requirements';
    user.verificationApprovedAt      = null;
    await user.save();

    try {
      const { sendVerificationRejectedEmail } = require('../utils/emailService');
      await sendVerificationRejectedEmail(user.email, user.name, reason);
    } catch (emailError) {
      console.error('Failed to send verification rejection email:', emailError);
    }

    res.json({
      success: true,
      message: 'Verification rejected',
      user: { _id: user._id, name: user.name, email: user.email, status: 'rejected' },
    });
  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /request (selfie only, legacy) ─────────────────────────────────────
router.post('/request', protect, upload.fields([{ name: 'selfiePhoto', maxCount: 1 }]), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.verified && user.verificationStatus === 'approved') {
      return res.status(400).json({ success: false, message: 'Already verified' });
    }
    const files = req.files;
    if (!files || !files.selfiePhoto || !files.selfiePhoto[0]) {
      return res.status(400).json({ success: false, message: 'Selfie photo required' });
    }
    const selfieResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'afroconnect_verifications/selfies' },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(files.selfiePhoto[0].buffer);
    });
    user.verificationStatus = 'pending';
    user.selfiePhoto = { url: selfieResult.secure_url, publicId: selfieResult.public_id, submittedAt: new Date() };
    user.verificationRequestDate = new Date();
    await user.save();
    res.json({ success: true, message: 'Verification request submitted', status: 'pending' });
  } catch (error) {
    console.error('Verification request error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

module.exports = router;
