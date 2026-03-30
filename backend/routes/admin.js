
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Report = require('../models/Report');
const Match = require('../models/Match');
const Message = require('../models/Message');

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

// @route   GET /api/admin/reports
// @desc    Get all reports
// @access  Private/Admin
router.get('/reports', protect, isAdmin, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    
    const reports = await Report.find({ status })
      .populate('reporter', 'name email')
      .populate('reportedUser', 'name email photos')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/reports/:reportId/resolve
// @desc    Resolve a report
// @access  Private/Admin
router.put('/reports/:reportId/resolve', protect, isAdmin, async (req, res) => {
  try {
    const { action, notes } = req.body; // action: 'dismiss', 'warn', 'suspend', 'ban'
    
    const report = await Report.findById(req.params.reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    report.status = 'resolved';
    report.resolvedBy = req.user._id;
    report.resolvedAt = Date.now();
    report.adminNotes = notes;
    await report.save();

    const reportedUser = await User.findById(report.reportedUser);
    
    if (action === 'warn') {
      reportedUser.warnings = (reportedUser.warnings || 0) + 1;
      await reportedUser.save();
    } else if (action === 'suspend') {
      reportedUser.suspended = true;
      reportedUser.suspendedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
      await reportedUser.save();
    } else if (action === 'ban') {
      reportedUser.banned = true;
      reportedUser.bannedAt = Date.now();
      await reportedUser.save();
    }

    res.json({
      success: true,
      message: 'Report resolved',
      report
    });
  } catch (error) {
    console.error('Resolve report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with search and filters
// @access  Private/Admin
router.get('/users', protect, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, gender, minAge, maxAge, status } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (gender) query.gender = gender;
    if (minAge || maxAge) {
      query.age = {};
      if (minAge) query.age.$gte = parseInt(minAge);
      if (maxAge) query.age.$lte = parseInt(maxAge);
    }
    if (status) {
      if (status === 'banned') query.banned = true;
      if (status === 'verified') query.verified = true;
      if (status === 'pending_verification') query.verificationStatus = 'pending';
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:userId/ban
// @desc    Ban/unban a user and send notification email
// @access  Private/Admin
router.put('/users/:userId/ban', protect, isAdmin, async (req, res) => {
  try {
    const { banned, reason } = req.body;
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.banned = banned;
    if (banned) {
      user.bannedAt = Date.now();
      user.banReason = reason;
    } else {
      user.bannedAt = null;
      user.banReason = null;
    }
    
    await user.save();

    // Send email notification
    try {
      const { sendBanNotificationEmail, sendUnbanNotificationEmail } = require('../utils/emailService');
      
      if (banned) {
        await sendBanNotificationEmail(user.email, user.name, reason || 'Violation of community guidelines');
      } else {
        await sendUnbanNotificationEmail(user.email, user.name);
      }
    } catch (emailError) {
      console.error('Failed to send ban/unban notification email:', emailError);
      // Continue anyway - ban was still processed
    }

    res.json({
      success: true,
      message: banned ? 'User banned and notified' : 'User unbanned and notified',
      user
    });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/verifications
// @desc    Get pending verification requests
// @access  Private/Admin
router.get('/verifications', protect, isAdmin, async (req, res) => {
  try {
    const users = await User.find({ verificationStatus: 'pending' })
      .select('name email photos verificationPhoto verificationRequestDate')
      .sort({ verificationRequestDate: -1 })
      .limit(50);

    res.json({ success: true, verifications: users });
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/verifications/:userId
// @desc    Approve or reject verification
// @access  Private/Admin
router.put('/verifications/:userId', protect, isAdmin, async (req, res) => {
  try {
    const { action } = req.body;
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (action === 'approve') {
      user.verified = true;
      user.verificationStatus = 'approved';
    } else {
      user.verificationStatus = 'rejected';
      user.verificationPhoto = null;
    }
    
    await user.save();
    res.json({ success: true, message: `Verification ${action}d`, user });
  } catch (error) {
    console.error('Update verification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/admin/appeals
// @desc    User submits ban/suspension appeal
// @access  Private
router.post('/appeals', protect, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Appeal message is required' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ success: false, message: 'Appeal message must be under 1000 characters' });
    }

    const user = await User.findById(req.user._id);

    if (!user.banned && !user.suspended) {
      return res.status(400).json({ success: false, message: 'You do not have an active ban or suspension to appeal' });
    }

    // Check if already has pending appeal
    if (user.appeal && user.appeal.status === 'pending') {
      return res.status(400).json({ success: false, message: 'You already have a pending appeal' });
    }

    // Check 30-day cooldown after rejection
    if (user.appeal && user.appeal.status === 'rejected' && user.appeal.lastAppealRejectedAt) {
      const daysSinceRejection = (Date.now() - user.appeal.lastAppealRejectedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceRejection < 30) {
        const daysLeft = Math.ceil(30 - daysSinceRejection);
        return res.status(400).json({ 
          success: false, 
          message: `You can submit a new appeal in ${daysLeft} days` 
        });
      }
    }

    user.appeal = {
      status: 'pending',
      message,
      submittedAt: Date.now()
    };
    await user.save();

    res.json({ success: true, message: 'Appeal submitted successfully. Admins will review it soon.' });
  } catch (error) {
    console.error('Appeal submission error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/appeals
// @desc    Get all pending appeals
// @access  Private/Admin
router.get('/appeals', protect, isAdmin, async (req, res) => {
  try {
    const appeals = await User.find({ 'appeal.status': 'pending' })
      .select('name email banned suspended appeal bannedAt suspendedUntil')
      .sort({ 'appeal.submittedAt': -1 })
      .limit(100);

    res.json({ success: true, appeals });
  } catch (error) {
    console.error('Get appeals error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/appeals/:userId
// @desc    Review user appeal - approve or reject and send decision email
// @access  Private/Admin
router.put('/appeals/:userId', protect, isAdmin, async (req, res) => {
  try {
    const { action, adminResponse } = req.body; // action: 'approve', 'reject'
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.appeal || user.appeal.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending appeal for this user' });
    }

    user.appeal.status = action === 'approve' ? 'approved' : 'rejected';
    user.appeal.reviewedAt = Date.now();
    user.appeal.reviewedBy = req.user._id;
    user.appeal.adminResponse = adminResponse || '';
    
    if (action === 'reject') {
      user.appeal.lastAppealRejectedAt = Date.now();
    }

    if (action === 'approve') {
      // Unban/unsuspend the user
      user.banned = false;
      user.bannedAt = null;
      user.banReason = null;
      user.suspended = false;
      user.suspendedUntil = null;
    }

    await user.save();

    // Send appeal decision email
    try {
      const { sendAppealDecisionEmail } = require('../utils/emailService');
      const approved = action === 'approve';
      await sendAppealDecisionEmail(user.email, user.name, approved, adminResponse);
    } catch (emailError) {
      console.error('Failed to send appeal decision email:', emailError);
      // Continue anyway - appeal was still processed
    }

    res.json({ 
      success: true, 
      message: action === 'approve' ? 'Appeal approved, user unbanned, and notified' : 'Appeal rejected and user notified',
      user 
    });
  } catch (error) {
    console.error('Review appeal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/verifications
// @desc    Get pending verification requests
// @access  Private/Admin
router.get('/verifications', protect, isAdmin, async (req, res) => {
  try {
    const verifications = await User.find({ 
      verificationStatus: 'pending'
    }).select('_id name email idPhoto selfiePhoto verificationRequestDate photos');

    res.json({
      success: true,
      verifications
    });
  } catch (error) {
    console.error('Get verifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/verifications/:userId/approve
// @desc    Approve user verification
// @access  Private/Admin
router.put('/verifications/:userId/approve', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.verified = true;
    user.verificationStatus = 'approved';
    user.verificationApprovedBy = req.user._id;
    user.verificationApprovedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'User verified successfully',
      user: { _id: user._id, name: user.name, email: user.email, verified: true }
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/verifications/:userId/reject
// @desc    Reject user verification
// @access  Private/Admin
router.put('/verifications/:userId/reject', protect, isAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.verificationStatus = 'rejected';
    user.verificationRejectionReason = reason || 'Photos do not meet requirements';
    await user.save();

    res.json({
      success: true,
      message: 'Verification rejected'
    });
  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/stats
// @desc    Get platform statistics
// @access  Private/Admin
// @route   GET /api/admin/analytics
// @desc    Get platform analytics (profile views, match rate)
// @access  Private/Admin
router.get('/analytics', protect, isAdmin, async (req, res) => {
  try {
    const Activity = require('../models/Activity');
    
    // Profile views this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const profileViews = await Activity.countDocuments({
      type: 'profile_view',
      timestamp: { $gte: startOfMonth }
    });

    // Match rate across platform
    const totalMatches = await Match.countDocuments({ status: 'active' });
    const totalUsers = await User.countDocuments();
    const avgMatchRate = totalUsers > 0 ? ((totalMatches / totalUsers) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      analytics: {
        profileViewsMonth: profileViews,
        totalMatches,
        totalUsers,
        avgMatchRate
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/subscriptions-revenue
// @desc    Get subscription analytics and revenue
// @access  Private/Admin
router.get('/subscriptions-revenue', protect, isAdmin, async (req, res) => {
  try {
    const activeSubscriptions = await User.countDocuments({ 'premium.isActive': true });
    const premiumPlans = await User.find({ 'premium.isActive': true }).select('premium name');
    
    const plansBreakdown = {};
    premiumPlans.forEach(u => {
      const plan = u.premium?.plan || 'unknown';
      plansBreakdown[plan] = (plansBreakdown[plan] || 0) + 1;
    });

    res.json({
      success: true,
      subscriptions: {
        totalActive: activeSubscriptions,
        plansBreakdown,
        estimatedMonthlyRevenue: activeSubscriptions * 15
      }
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/activity-monitoring
// @desc    Get user activity metrics
// @access  Private/Admin
router.get('/activity-monitoring', protect, isAdmin, async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const active24h = await User.countDocuments({ lastActive: { $gte: last24h } });
    const active7d = await User.countDocuments({ lastActive: { $gte: last7d } });
    const messages24h = await Message.countDocuments({ createdAt: { $gte: last24h } });

    res.json({
      success: true,
      activity: {
        active24h,
        active7d,
        messages24h,
        onlineNow: await User.countDocuments({ online: true })
      }
    });
  } catch (error) {
    console.error('Activity error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/stories-moderation
// @desc    Get flagged stories for moderation
// @access  Private/Admin
router.get('/stories-moderation', protect, isAdmin, async (req, res) => {
  try {
    const Story = require('../models/Story');
    const flaggedStories = await Story.find({ flagged: true })
      .populate('userId', 'name email')
      .limit(50)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      flaggedStories: flaggedStories || [],
      totalFlagged: flaggedStories?.length || 0
    });
  } catch (error) {
    console.error('Stories moderation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/boosts-revenue
// @desc    Get boost usage and revenue
// @access  Private/Admin
router.get('/boosts-revenue', protect, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('boosts premiumInfo');
    let totalBoosts = 0;
    let usersWithBoosts = 0;

    users.forEach(u => {
      if (u.boosts && u.boosts > 0) {
        totalBoosts += u.boosts;
        usersWithBoosts++;
      }
    });

    res.json({
      success: true,
      boosts: {
        totalBoostsIssued: totalBoosts,
        usersWithBoosts,
        estimatedBoostRevenue: usersWithBoosts * 5
      }
    });
  } catch (error) {
    console.error('Boosts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/stats', protect, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ verified: true });
    const activeToday = await User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    const totalMatches = await Match.countDocuments({ status: 'active' });
    const totalMessages = await Message.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const bannedUsers = await User.countDocuments({ banned: true });

    res.json({
      success: true,
      stats: {
        totalUsers,
        verifiedUsers,
        activeToday,
        totalMatches,
        totalMessages,
        pendingReports,
        bannedUsers
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/proxy-profile/:userId
// @desc    Admin proxy to view user profile data as JSON
// @access  Private/Admin
router.get('/proxy-profile/:userId', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/users/:userId
// @desc    Get single user detail
// @access  Private/Admin
router.get('/users/:userId', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/admin/stories/:storyId
// @desc    Remove a story
// @access  Private/Admin
router.delete('/stories/:storyId', protect, isAdmin, async (req, res) => {
  try {
    const Story = require('../models/Story');
    const story = await Story.findById(req.params.storyId);
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }
    await Story.findByIdAndDelete(req.params.storyId);
    res.json({ success: true, message: 'Story removed successfully' });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
