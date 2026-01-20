const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const { protect } = require('../middleware/auth');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/aac'];
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.dll', '.scr', '.js', '.vbs'];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_AUDIO_SIZE = 5 * 1024 * 1024;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const imageUpload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
    }
  },
});

const audioUpload = multer({
  storage,
  limits: { fileSize: MAX_AUDIO_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (MP3, M4A, WAV, WebM, OGG) are allowed'), false);
    }
  },
});

const fileUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      return cb(new Error('This file type is not allowed for security reasons'), false);
    }
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported. Allowed: PDF, DOC, DOCX only'), false);
    }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Increased to 50MB for video
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  },
});

// Middleware for handling both single fields and generic files
const multiUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ success: false, message: err.message });
    }
    
    // Normalize req.file if only one file was uploaded
    if (req.files && req.files.length > 0) {
      const photoFile = req.files.find(f => f.fieldname === 'photo' || f.fieldname === 'file');
      const videoFile = req.files.find(f => f.fieldname === 'video');
      const audioFile = req.files.find(f => f.fieldname === 'audio');
      
      if (photoFile) req.file = photoFile;
      else if (videoFile) req.file = videoFile;
      else if (audioFile) req.file = audioFile;
      else req.file = req.files[0];
    }
    
    next();
  });
};

router.post('/photo', protect, multiUpload, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      console.log('No file in photo request:', { body: req.body, files: !!req.files, file: !!req.file });
      return res.status(400).json({ success: false, message: 'No photo uploaded' });
    }

    // Compress image using sharp
    const compressedBuffer = await sharp(file.buffer)
      .resize(1200, 1500, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();

    const b64 = compressedBuffer.toString('base64');
    const dataURI = `data:image/jpeg;base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'afroconnect/profiles',
      resource_type: 'image',
      transformation: [
        { width: 800, height: 1000, crop: 'fill', gravity: 'face' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ],
    });

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      originalSize: req.file.size,
      compressedSize: compressedBuffer.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
});

const handleAudioUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (req.file.size > MAX_AUDIO_SIZE) {
      return res.status(400).json({ 
        success: false, 
        message: `Audio file too large. Maximum size is ${MAX_AUDIO_SIZE / (1024 * 1024)}MB` 
      });
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'afroconnect/voice-notes',
      resource_type: 'video',
    });

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration || req.body.duration || 0,
      size: req.file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
};

router.post('/voice', protect, audioUpload.single('audio'), handleAudioUpload);
router.post('/audio', protect, audioUpload.single('audio'), handleAudioUpload);

// Delete photo - accepts publicId as query param or encoded in URL
router.delete('/photo', protect, async (req, res) => {
  try {
    const publicId = req.query.publicId || req.body.publicId;
    const User = require('../models/User');
    
    if (!publicId) {
      return res.status(400).json({ success: false, message: 'Photo ID required' });
    }

    // First, verify the user owns this photo
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const photoExists = user.photos.some(photo => 
      photo.publicId === publicId || photo._id?.toString() === publicId
    );

    if (!photoExists) {
      return res.status(403).json({ success: false, message: 'Photo not found or not authorized' });
    }

    // Remove from user's photos array first
    user.photos = user.photos.filter(photo => 
      photo.publicId !== publicId && photo._id?.toString() !== publicId
    );
    
    // Ensure at least one photo remains primary
    if (user.photos.length > 0 && !user.photos.some(p => p.isPrimary)) {
      user.photos[0].isPrimary = true;
    }
    
    await user.save();

    // Delete from Cloudinary after confirming ownership
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (cloudinaryError) {
      console.log('Cloudinary delete error (may not exist):', cloudinaryError.message);
    }

    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ success: false, message: error.message || 'Delete failed' });
  }
});

router.post('/file', protect, fileUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const ext = '.' + req.file.originalname.split('.').pop().toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ 
        success: false, 
        message: 'This file type is not allowed for security reasons' 
      });
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'afroconnect/files',
      resource_type: 'auto',
    });

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
});

router.post('/chat-image', protect, imageUpload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    }

    const uploadedImages = await Promise.all(
      req.files.map(async (file) => {
        const compressedBuffer = await sharp(file.buffer)
          .resize(1200, 1200, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({
            quality: 80,
            progressive: true,
            mozjpeg: true
          })
          .toBuffer();

        const b64 = compressedBuffer.toString('base64');
        const dataURI = `data:image/jpeg;base64,${b64}`;

        const result = await cloudinary.uploader.upload(dataURI, {
          folder: 'afroconnect/chat-images',
          resource_type: 'image',
        });

        return {
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        };
      })
    );

    res.json({
      success: true,
      images: uploadedImages,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
});

router.post('/video', protect, multiUpload, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No video uploaded' });
    }

    const b64 = file.buffer.toString('base64');
    const dataURI = `data:${file.mimetype};base64,${b64}`;
    
    console.log('Video upload starting for:', file.originalname);

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'afroconnect/stories',
      resource_type: 'auto',
    });

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id
    });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
});

module.exports = router;
