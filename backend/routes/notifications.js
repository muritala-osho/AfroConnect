const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// Store for user push tokens
const userPushTokens = new Map();

// @route   POST /api/notifications/register-token
// @desc    Register device push token
// @access  Private
router.post('/register-token', protect, async (req, res) => {
  try {
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'Push token is required'
      });
    }

    // Update the user's push token and enable notifications
    await User.findByIdAndUpdate(req.user._id, {
      pushToken,
      pushNotificationsEnabled: true
    });

    // Optionally, you can also update the in-memory map if you are still using it
    // For now, we'll rely on the database for consistency
    // userPushTokens.set(req.user._id.toString(), pushToken);

    res.json({
      success: true,
      message: 'Push token registered successfully'
    });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/notifications/send
// @desc    Send push notification to user
// @access  Private
router.post('/send', protect, async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;

    // Fetch user from DB to get their push token and check if notifications are enabled
    const user = await User.findById(userId);

    if (!user || user.pushNotificationsEnabled === false || !user.pushToken) {
      return res.status(404).json({
        success: false,
        message: 'User push token not found or notifications disabled'
      });
    }

    const pushToken = user.pushToken;

    const { sendExpoPushNotification } = require('../utils/pushNotifications');
    const result = await sendExpoPushNotification(pushToken, { title, body, data });

    res.json({
      success: true,
      message: 'Notification sent'
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;