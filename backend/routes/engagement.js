/**
 * Engagement tracking routes
 * Feeds real open/interaction data back into the notification timing model.
 */

const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { recordNotificationOpened, getEngagementSummary } = require('../utils/notificationTimingEngine');

// @route  POST /api/engagement/notification-opened
// @desc   Called by the mobile app when the user taps a push notification.
//         Records the hour of engagement to refine the timing model.
// @access Private
router.post('/notification-opened', protect, async (req, res) => {
  try {
    const { notificationType, screen } = req.body;
    const hourUTC = new Date().getUTCHours();

    recordNotificationOpened(req.user, hourUTC);
    req.user.lastNotificationOpenedAt = new Date();

    // Also count total opens for analytics
    req.user.totalNotificationOpens = (req.user.totalNotificationOpens || 0) + 1;

    await req.user.save();

    res.json({ success: true, message: 'Engagement recorded', hour: hourUTC });
  } catch (err) {
    console.error('Engagement tracking error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route  GET /api/engagement/my-stats
// @desc   Returns the user's notification engagement stats (for debugging / profile page)
// @access Private
router.get('/my-stats', protect, async (req, res) => {
  try {
    const summary = getEngagementSummary(req.user);
    res.json({
      success: true,
      churnScore: req.user.churnScore || 0,
      notifications: summary,
    });
  } catch (err) {
    console.error('Engagement stats error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route  GET /api/engagement/admin/churn-overview
// @desc   Returns aggregate churn risk distribution for the admin dashboard
// @access Private/Admin
router.get('/admin/churn-overview', protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const [healthy, atRisk, highRisk, critical] = await Promise.all([
      User.countDocuments({ emailVerified: true, banned: false, churnScore: { $lt: 0.50 } }),
      User.countDocuments({ emailVerified: true, banned: false, churnScore: { $gte: 0.50, $lt: 0.65 } }),
      User.countDocuments({ emailVerified: true, banned: false, churnScore: { $gte: 0.65, $lt: 0.80 } }),
      User.countDocuments({ emailVerified: true, banned: false, churnScore: { $gte: 0.80 } }),
    ]);

    // Top churners for manual review
    const topChurners = await User.find({
      emailVerified: true,
      banned: false,
      churnScore: { $gte: 0.65 },
    })
      .select('name email lastActive churnScore churnInterventionTier churnInterventionSentAt premium')
      .sort({ churnScore: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      distribution: { healthy, atRisk, highRisk, critical },
      topChurners,
      lastUpdated: new Date(),
    });
  } catch (err) {
    console.error('Churn overview error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
