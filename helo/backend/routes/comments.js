const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.pushNotificationsEnabled || !user.pushToken) {
      return;
    }

    const message = {
      to: user.pushToken,
      sound: 'default',
      title,
      body,
      data,
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

router.post('/profile/:userId', protect, async (req, res) => {
  try {
    const { text, photoIndex } = req.body;
    const { userId } = req.params;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const newComment = {
      _id: new (require('mongoose').Types.ObjectId)(),
      authorId: req.user.id,
      authorName: req.user.name,
      authorPhoto: req.user.photos && req.user.photos.length > 0 ? req.user.photos[0] : null,
      text: text.trim(),
      photoIndex: photoIndex !== undefined ? photoIndex : null,
      createdAt: new Date()
    };

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          profileComments: newComment
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (userId !== req.user.id) {
      const notificationTitle = 'New Comment';
      const notificationBody = (photoIndex !== undefined && photoIndex !== null)
        ? `${req.user.name} commented on your photo`
        : `${req.user.name} commented on your profile`;
      
      sendPushNotification(userId, notificationTitle, notificationBody, {
        type: 'comment',
        commenterId: req.user.id,
        photoIndex: photoIndex !== undefined ? photoIndex : null
      });
    }

    res.status(201).json({ success: true, comments: user.profileComments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { photoIndex } = req.query;
    
    const user = await User.findById(userId).select('profileComments');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let comments = user.profileComments || [];
    
    if (photoIndex !== undefined) {
      const idx = parseInt(photoIndex, 10);
      comments = comments.filter(c => c.photoIndex === idx);
    }

    res.json({ 
      success: true, 
      comments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { photoId, userId, text } = req.body;
    const Comment = require('../models/Comment');
    const comment = await Comment.create({
      photoId,
      userId: req.user.id,
      text,
      author: req.user.name,
    });
    res.status(201).json({ success: true, comment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:photoId', async (req, res) => {
  try {
    const Comment = require('../models/Comment');
    const comments = await Comment.find({ photoId: req.params.photoId }).sort({ createdAt: -1 });
    res.json({ success: true, comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
