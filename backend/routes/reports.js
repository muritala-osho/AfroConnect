
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Report = require('../models/Report');
const User = require('../models/User');
const Story = require('../models/Story');
const Message = require('../models/Message');

router.post('/', protect, async (req, res) => {
  try {
    const { reportedUserId, reason, description, contentType, contentId, contentUrl, contentPreview } = req.body;

    if (!reportedUserId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Reported user and reason are required'
      });
    }

    if (reportedUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot report yourself'
      });
    }

    const validReasons = ['inappropriate', 'harassment', 'spam', 'fake', 'underage', 'other'];
    let normalizedReason = reason.toLowerCase().trim();
    if (!validReasons.includes(normalizedReason)) {
      normalizedReason = 'other';
    }

    const reportedUser = await User.findById(reportedUserId).select('photos name');
    if (!reportedUser) {
      return res.status(404).json({
        success: false,
        message: 'Reported user not found'
      });
    }

    let normalizedContentType = ['profile_photo', 'story', 'message_image', 'user', 'comment', 'voice_bio', 'success_story'].includes(contentType)
      ? contentType
      : 'user';
    let normalizedContentId = contentId ? String(contentId) : undefined;
    let normalizedContentUrl = contentUrl;
    let normalizedContentPreview = contentPreview;
    let contentMeta;

    if (normalizedContentType === 'profile_photo') {
      const photos = reportedUser.photos || [];
      let photoIndex = Number.parseInt(String(normalizedContentId ?? ''), 10);
      if (!Number.isInteger(photoIndex) || photoIndex < 0 || photoIndex >= photos.length) {
        photoIndex = photos.findIndex(photo => (photo?.url || photo) === normalizedContentUrl);
      }
      if (photoIndex < 0 && photos.length > 0) photoIndex = 0;
      const photo = photos[photoIndex];
      if (!photo) {
        normalizedContentType = 'user';
      } else {
        normalizedContentId = String(photoIndex);
        normalizedContentUrl = photo.url || photo;
        contentMeta = { photoIndex };
      }
    }

    if (normalizedContentType === 'story') {
      const story = await Story.findById(normalizedContentId);
      if (!story || story.user.toString() !== reportedUserId) {
        return res.status(400).json({ success: false, message: 'Story does not belong to the reported user' });
      }
      normalizedContentUrl = story.mediaUrl || story.imageUrl || story.thumbnail || normalizedContentUrl;
      normalizedContentPreview = story.textContent || story.content || normalizedContentPreview;
      contentMeta = { storyType: story.type };
    }

    if (normalizedContentType === 'message_image') {
      const message = await Message.findById(normalizedContentId);
      if (!message || message.sender.toString() !== reportedUserId || message.type !== 'image' || !message.imageUrl) {
        return res.status(400).json({ success: false, message: 'Image message does not belong to the reported user' });
      }
      normalizedContentUrl = message.imageUrl;
      normalizedContentPreview = message.content || 'Reported image message';
      contentMeta = { matchId: message.matchId };
    }

    const report = await Report.create({
      reporter: req.user._id,
      reportedBy: req.user._id,
      reportedUser: reportedUserId,
      reason: normalizedReason,
      description,
      matchId: req.body.matchId || undefined,
      contentType: normalizedContentType,
      contentId: normalizedContentId,
      contentUrl: normalizedContentUrl,
      contentPreview: normalizedContentPreview,
      contentMeta
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit report'
    });
  }
});

router.post('/block/:userId', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id);

    if (!user.blockedUsers.includes(req.params.userId)) {
      user.blockedUsers.push(req.params.userId);
      await user.save();
    }

    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block user'
    });
  }
});

router.delete('/block/:userId', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id);

    user.blockedUsers = user.blockedUsers.filter(
      id => id.toString() !== req.params.userId
    );
    await user.save();

    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Unblock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock user'
    });
  }
});

module.exports = router;
