const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { Expo } = require('expo-server-sdk');

// Always log every request to notification routes regardless of NODE_ENV
router.use((req, res, next) => {
  console.log(`[Notifications Route] ${req.method} ${req.path} — user: ${req.user?._id || 'unauthenticated'}`);
  next();
});

// @route   POST /api/notifications/register-token
// @desc    Register device push token
// @access  Private
router.post('/register-token', protect, async (req, res) => {
  const userId = req.user?._id;
  console.log(`[Notifications] register-token called — userId: ${userId}`);

  try {
    const { pushToken } = req.body;

    if (!pushToken) {
      console.warn(`[Notifications] register-token — no token in body for user ${userId}`);
      return res.status(400).json({
        success: false,
        message: 'Push token is required',
      });
    }

    // Validate it looks like an Expo token before storing
    if (!Expo.isExpoPushToken(pushToken)) {
      console.warn(`[Notifications] register-token — invalid Expo token format for user ${userId}: ${pushToken}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid Expo push token format',
      });
    }

    await User.findByIdAndUpdate(userId, {
      pushToken,
      pushNotificationsEnabled: true,
    });

    console.log(`[Notifications] ✅ Token stored for user ${userId}: ${pushToken.slice(0, 40)}…`);

    res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error(`[Notifications] register-token error for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   POST /api/notifications/register-voip-token
// @desc    Register iOS VoIP (PushKit) push token for native CallKit support
// @access  Private
router.post('/register-voip-token', protect, async (req, res) => {
  const userId = req.user?._id;
  console.log(`[Notifications] register-voip-token — userId: ${userId}`);

  try {
    const { voipToken } = req.body;

    if (!voipToken) {
      return res.status(400).json({ success: false, message: 'voipToken is required' });
    }

    await User.findByIdAndUpdate(userId, { voipPushToken: voipToken });
    console.log(`[Notifications] ✅ VoIP token stored for user ${userId}: ${voipToken.slice(0, 20)}…`);
    res.json({ success: true, message: 'VoIP token registered' });
  } catch (error) {
    console.error(`[Notifications] register-voip-token error for user ${userId}:`, error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/notifications/send
// @desc    Send push notification to a specific user (admin/system use)
// @access  Private
router.post('/send', protect, async (req, res) => {
  const callerId = req.user?._id;
  console.log(`[Notifications] /send called by user ${callerId}`);

  try {
    const { userId, title, body, data } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      console.warn(`[Notifications] /send — target user ${userId} not found`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.pushToken) {
      console.warn(`[Notifications] /send — user ${userId} has no push token stored`);
      return res.status(404).json({
        success: false,
        message: 'User has no push token — they may not have opened the app yet or permissions were denied',
      });
    }

    console.log(`[Notifications] /send — sending to user ${userId}, token: ${user.pushToken.slice(0, 40)}…`);
    const { sendSmartNotification } = require('../utils/pushNotifications');
    const sent = await sendSmartNotification(user, { title, body, data }, 'system');

    console.log(`[Notifications] /send — result: ${sent ? 'sent' : 'suppressed'}`);
    res.json({ success: true, sent, message: sent ? 'Notification sent' : 'Notification suppressed by user preferences' });
  } catch (error) {
    console.error('[Notifications] /send error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/notifications/test
// @desc    Send a test push notification to the calling user's own device.
//          Use this to verify the full pipeline: token stored → Expo API called → device receives.
// @access  Private
router.post('/test', protect, async (req, res) => {
  const userId = req.user?._id;
  console.log(`[Notifications] /test called — userId: ${userId}`);

  try {
    const user = await User.findById(userId).select(
      'pushToken pushNotificationsEnabled muteSettings notificationPreferences name'
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.pushToken) {
      console.warn(`[Notifications] /test — user ${userId} has no push token. They need to open the app on a device first.`);
      return res.status(400).json({
        success: false,
        message: 'No push token found for your account. Open the app on a physical device first to register a token.',
        debug: {
          pushNotificationsEnabled: user.pushNotificationsEnabled,
          hasPushToken: false,
        },
      });
    }

    if (!Expo.isExpoPushToken(user.pushToken)) {
      console.warn(`[Notifications] /test — stored token is invalid: ${user.pushToken}`);
      return res.status(400).json({
        success: false,
        message: 'Stored push token is invalid. Open the app on a physical device to re-register.',
        debug: { storedToken: user.pushToken },
      });
    }

    console.log(`[Notifications] /test — sending test notification to user ${userId} at token ${user.pushToken.slice(0, 40)}…`);

    const { sendExpoPushNotification } = require('../utils/pushNotifications');
    const tickets = await sendExpoPushNotification(user.pushToken, {
      title: '🔔 Test Notification',
      body: 'If you see this, push notifications are working correctly!',
      data: { type: 'test' },
      priority: 'high',
      channelId: 'default',
    });

    console.log(`[Notifications] /test — Expo tickets:`, JSON.stringify(tickets));

    res.json({
      success: true,
      message: 'Test notification sent — check your device.',
      debug: {
        userId,
        tokenPreview: user.pushToken.slice(0, 40) + '…',
        expoTickets: tickets,
      },
    });
  } catch (error) {
    console.error('[Notifications] /test error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @route   GET /api/notifications/status
// @desc    Check if the current user has a registered push token
// @access  Private
router.get('/status', protect, async (req, res) => {
  const userId = req.user?._id;
  try {
    const user = await User.findById(userId).select('pushToken pushNotificationsEnabled');
    res.json({
      success: true,
      hasPushToken: !!user?.pushToken,
      pushNotificationsEnabled: user?.pushNotificationsEnabled ?? false,
      tokenPreview: user?.pushToken ? user.pushToken.slice(0, 40) + '…' : null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
