const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Session = require('../models/Session');
const redis = require('../utils/redis');

router.get('/', protect, async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user._id }).sort({ lastActive: -1 });
    const currentSessionId = req.sessionId;

    const sessionData = sessions.map((s) => ({
      _id: s._id,
      sessionId: s.sessionId,
      deviceName: s.deviceName,
      platform: s.platform,
      ipAddress: s.ipAddress,
      city: s.city,
      country: s.country,
      lastActive: s.lastActive,
      createdAt: s.createdAt,
      isCurrent: s.sessionId === currentSessionId,
    }));

    res.json({ success: true, sessions: sessionData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load sessions' });
  }
});

router.delete('/others', protect, async (req, res) => {
  try {
    const currentSessionId = req.sessionId;

    const otherSessions = await Session.find({
      userId: req.user._id,
      sessionId: { $ne: currentSessionId },
    });

    if (otherSessions.length === 0) {
      return res.json({ success: true, message: 'No other active sessions' });
    }

    await Promise.all(
      otherSessions.map((s) =>
        redis.set(`revoked:${s.sessionId}`, '1', 7 * 24 * 60 * 60)
      )
    );

    await Session.deleteMany({
      userId: req.user._id,
      sessionId: { $ne: currentSessionId },
    });

    res.json({
      success: true,
      message: `${otherSessions.length} other device(s) logged out`,
      count: otherSessions.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to log out other devices' });
  }
});

router.delete('/:sessionId', protect, async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (sessionId === req.sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Use the logout button to end your current session',
      });
    }

    const session = await Session.findOne({ sessionId, userId: req.user._id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    await redis.set(`revoked:${sessionId}`, '1', 7 * 24 * 60 * 60);
    await Session.deleteOne({ sessionId });

    res.json({ success: true, message: 'Device logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to log out device' });
  }
});

module.exports = router;
