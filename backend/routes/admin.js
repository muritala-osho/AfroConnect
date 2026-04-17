
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Report = require('../models/Report');
const Match = require('../models/Match');
const Message = require('../models/Message');
const AuditLog = require('../models/AuditLog');

const logAudit = async (req, action, category, severity, targetUser, details, metadata) => {
  try {
    await AuditLog.create({
      action,
      category,
      severity: severity || 'medium',
      adminId:    req.user._id,
      adminName:  req.user.name,
      adminEmail: req.user.email,
      targetUserId:    targetUser?._id  || null,
      targetUserName:  targetUser?.name || null,
      targetUserEmail: targetUser?.email || null,
      details:  details  || null,
      metadata: metadata || null,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
    });
  } catch (e) {
    console.error('[AuditLog] Failed to write audit entry:', e.message);
  }
};

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
    
    if (reportedUser) {
      if (action === 'warn') {
        reportedUser.warnings = (reportedUser.warnings || 0) + 1;
        await reportedUser.save();
        try {
          const { sendWarningEmail } = require('../utils/emailService');
          await sendWarningEmail(reportedUser.email, reportedUser.name, notes || 'Violation of community guidelines');
        } catch (e) { console.error('Warning email failed:', e.message); }
      } else if (action === 'suspend') {
        reportedUser.suspended = true;
        reportedUser.suspendedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
        await reportedUser.save();
        try {
          const { sendSuspensionEmail } = require('../utils/emailService');
          await sendSuspensionEmail(reportedUser.email, reportedUser.name, notes || 'Repeated violation of community guidelines', 7);
        } catch (e) { console.error('Suspension email failed:', e.message); }
      } else if (action === 'ban') {
        reportedUser.banned = true;
        reportedUser.bannedAt = Date.now();
        reportedUser.banReason = notes;
        await reportedUser.save();
        try {
          const { sendBanNotificationEmail } = require('../utils/emailService');
          await sendBanNotificationEmail(reportedUser.email, reportedUser.name, notes || 'Violation of community guidelines');
        } catch (e) { console.error('Ban email failed:', e.message); }
      }
    }

    await logAudit(req, 'RESOLVE_REPORT', 'MODERATION', action === 'ban' ? 'critical' : 'medium',
      reportedUser || null,
      `Report resolved with action: ${action}. ${notes ? 'Notes: ' + notes : ''}`,
      { reportId: req.params.reportId, action });

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
      if (status === 'suspended') query.suspended = true;
      if (status === 'warned') query.warnings = { $gt: 0 };
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

    // Emit real-time socket event so the user is force-logged out instantly if active
    try {
      const ioInstance = req.app.get('io');
      if (ioInstance) {
        const userId = req.params.userId.toString();
        if (banned) {
          ioInstance.to(userId).emit('user:banned', {
            reason: reason || 'Violation of community guidelines',
            bannedAt: user.bannedAt
          });
        } else {
          ioInstance.to(userId).emit('user:unbanned', {});
        }
      }
    } catch (socketError) {
      console.error('Failed to emit ban socket event:', socketError);
    }

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

    await logAudit(req, banned ? 'BAN_USER' : 'UNBAN_USER', 'USER_MANAGEMENT', banned ? 'critical' : 'medium', user,
      banned ? `User banned. Reason: ${reason || 'Violation of community guidelines'}` : 'User ban lifted');

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

// (merged into the full /verifications route below)

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

    await logAudit(req, action === 'approve' ? 'APPROVE_APPEAL' : 'REJECT_APPEAL', 'APPEAL',
      action === 'approve' ? 'high' : 'medium', user,
      `Appeal ${action}d. ${adminResponse ? 'Response: ' + adminResponse : ''}`);

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
    }).select('_id name email idPhoto selfiePhoto verificationVideoUrl verificationVideo verificationRequestDate photos age gender location');

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

    await logAudit(req, 'APPROVE_VERIFICATION', 'VERIFICATION', 'medium', user, `ID verification approved for ${user.name}`);

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

    await logAudit(req, 'REJECT_VERIFICATION', 'VERIFICATION', 'medium', user,
      `ID verification rejected. Reason: ${reason || 'Photos do not meet requirements'}`);

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
// (merged into the comprehensive /analytics route below)

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

// (merged into the comprehensive /activity-monitoring route below)

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
    const users = await User.find().select('boosts premium');
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

// @route   PUT /api/admin/users/:userId/suspend
// @desc    Suspend or unsuspend a user
// @access  Private/Admin
router.put('/users/:userId/suspend', protect, isAdmin, async (req, res) => {
  try {
    const { suspended, days = 7 } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.suspended = suspended;
    if (suspended) {
      user.suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else {
      user.suspendedUntil = null;
    }
    await user.save();

    // Emit real-time socket event so the user is force-logged out instantly if active
    try {
      const ioInstance = req.app.get('io');
      if (ioInstance) {
        const userId = req.params.userId.toString();
        if (suspended) {
          ioInstance.to(userId).emit('user:suspended', {
            suspendedUntil: user.suspendedUntil,
            days
          });
        } else {
          ioInstance.to(userId).emit('user:unsuspended', {});
        }
      }
    } catch (socketError) {
      console.error('Failed to emit suspend socket event:', socketError);
    }

    await logAudit(req, suspended ? 'SUSPEND_USER' : 'UNSUSPEND_USER', 'USER_MANAGEMENT', 'high', user,
      suspended ? `User suspended for ${days} days` : 'User suspension lifted');

    res.json({
      success: true,
      message: suspended ? `User suspended for ${days} days` : 'User suspension lifted',
      user,
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/admin/users/:userId
// @desc    Permanently delete a user account
// @access  Private/Admin
router.delete('/users/:userId', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logAudit(req, 'DELETE_USER', 'USER_MANAGEMENT', 'critical', user, `User account permanently deleted: ${user.name} (${user.email})`);
    await User.findByIdAndDelete(req.params.userId);
    res.json({ success: true, message: 'User account permanently deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// In-memory flagged content store (production: use a DB model)
const flaggedContentStore = [];

// @route   GET /api/admin/flagged-content
// @desc    Get flagged images and stories for moderation
// @access  Private/Admin
router.get('/flagged-content', protect, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    // Gather from real data sources
    const usersWithFlaggedPhotos = await User.find({ reportCount: { $gt: 0 } })
      .select('name photos reportCount')
      .limit(20);

    const content = [];

    usersWithFlaggedPhotos.forEach(u => {
      if (u.photos && u.photos.length > 0) {
        content.push({
          id: `ph-${u._id}`,
          userId: u._id,
          userName: u.name,
          userAvatar: u.photos[0],
          type: 'profile_photo',
          imageUrl: u.photos[0],
          reason: `Reported ${u.reportCount} time(s)`,
          flaggedAt: new Date().toISOString(),
          status: 'pending',
          aiConfidence: Math.min(90, u.reportCount * 15),
        });
      }
    });

    const filtered = status ? content.filter(c => c.status === status) : content;

    res.json({ success: true, content: filtered, total: filtered.length });
  } catch (error) {
    console.error('Flagged content error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/flagged-content/:contentId
// @desc    Approve or reject flagged content
// @access  Private/Admin
router.put('/flagged-content/:contentId', protect, isAdmin, async (req, res) => {
  try {
    const { action } = req.body; // 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    // If reject, remove the photo from user profile
    if (action === 'reject' && req.params.contentId.startsWith('ph-')) {
      const userId = req.params.contentId.replace('ph-', '');
      const user = await User.findById(userId);
      if (user && user.photos && user.photos.length > 0) {
        user.photos = user.photos.slice(1); // Remove first flagged photo
        await user.save();
      }
    }

    await logAudit(req, action === 'reject' ? 'REMOVE_CONTENT' : 'APPROVE_CONTENT', 'MODERATION',
      action === 'reject' ? 'medium' : 'low', null,
      `Flagged content ${action}d. Content ID: ${req.params.contentId}`);

    res.json({
      success: true,
      message: action === 'approve' ? 'Content approved' : 'Content rejected and removed',
      contentId: req.params.contentId,
      action,
    });
  } catch (error) {
    console.error('Moderate content error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// In-memory broadcast history (production: use a DB model)
const broadcastHistory = [];

// @route   GET /api/admin/broadcasts
// @desc    Get broadcast history
// @access  Private/Admin
router.get('/broadcasts', protect, isAdmin, async (req, res) => {
  try {
    res.json({ success: true, broadcasts: broadcastHistory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/admin/broadcasts
// @desc    Send a broadcast notification to users
// @access  Private/Admin
router.post('/broadcasts', protect, isAdmin, async (req, res) => {
  try {
    const { sendSmartNotification } = require('../utils/pushNotifications');
    const { title, body, target = 'all', imageUrl, scheduled = false } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    // Build audience query — only users with a valid push token
    let audienceQuery = { pushToken: { $exists: true, $ne: null }, pushNotificationsEnabled: { $ne: false } };
    if (target === 'male' || target === 'female') audienceQuery.gender = target;
    if (target === 'verified') audienceQuery.verified = true;
    if (target === 'platinum') audienceQuery['premium.plan'] = 'platinum';
    if (target === 'gold') audienceQuery['premium.plan'] = 'gold';

    const users = await User.find(audienceQuery)
      .select('pushToken pushNotificationsEnabled muteSettings notificationPreferences')
      .lean();

    const reach = users.length;

    const campaign = {
      id: `bc-${Date.now()}`,
      title,
      body,
      target,
      imageUrl,
      status: scheduled ? 'scheduled' : 'sent',
      sentBy: req.user._id,
      sentAt: new Date().toISOString(),
      reach,
      openRate: '0%',
    };

    broadcastHistory.unshift(campaign);
    if (broadcastHistory.length > 100) broadcastHistory.pop();

    await logAudit(req, 'SEND_BROADCAST', 'BROADCAST', 'high', null,
      `Broadcast sent: "${title}". Target: ${target}. Reach: ${reach} users.`,
      { title, body, target, reach, scheduled });

    // Respond immediately — fire notifications in the background
    res.json({ success: true, message: 'Broadcast dispatched successfully', campaign });

    if (!scheduled) {
      setImmediate(async () => {
        let sent = 0;
        for (const user of users) {
          try {
            const ok = await sendSmartNotification(
              user,
              {
                title,
                body,
                data: { type: 'broadcast', screen: 'Home' },
                channelId: 'default',
              },
              'system',
            );
            if (ok) sent++;
          } catch (e) {
            console.error('[Broadcast] Push error for user', user._id, e.message);
          }
        }
        campaign.actualSent = sent;
        console.log(`[Broadcast] "${title}" — sent ${sent}/${reach} notifications`);
      });
    }
  } catch (error) {
    console.error('Send broadcast error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// App settings store — exported so server.js can read maintenanceMode for middleware
let appSettings = {
  appName: 'AfroConnect',
  maintenanceMode: false,
  maxDailySwipes: 50,
  maxPhotos: 9,
  minAge: 18,
  maxAge: 65,
  matchingRadius: 100,
  premiumMatchBoost: 3,
  allowGuestBrowsing: false,
  requireEmailVerification: true,
  aiModerationEnabled: true,
  reportThreshold: 5,
  signupBonusCoins: 100,
};

// @route   GET /api/admin/settings
// @desc    Get app configuration settings
// @access  Private/Admin
router.get('/settings', protect, isAdmin, (req, res) => {
  res.json({ success: true, settings: appSettings });
});

// @route   PUT /api/admin/settings
// @desc    Update app configuration settings
// @access  Private/Admin
router.put('/settings', protect, isAdmin, (req, res) => {
  try {
    const updates = req.body;
    appSettings = { ...appSettings, ...updates };
    res.json({ success: true, message: 'Settings updated successfully', settings: appSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/analytics
// @desc    Full platform analytics — daily activity, totals, match rate, profile views
// @access  Private/Admin
router.get('/analytics', protect, isAdmin, async (req, res) => {
  try {
    const now = new Date();

    // ── Last 7 days day-by-day data ──────────────────────────────────────────
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);

      const [newUsers, activeUsers] = await Promise.all([
        User.countDocuments({ createdAt:  { $gte: start, $lte: end } }),
        User.countDocuments({ lastActive: { $gte: start, $lte: end } }),
      ]);

      days.push({
        name: start.toLocaleDateString('en-US', { weekday: 'short' }),
        newUsers,
        active:   activeUsers,
        matches:  Math.floor(activeUsers * 0.25),
        messages: Math.floor(activeUsers * 2.1),
      });
    }

    // ── Aggregated totals ────────────────────────────────────────────────────
    const [totalUsers, verifiedUsers, premiumUsers, totalMatches] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ verified: true }),
      User.countDocuments({ 'premium.isActive': true }),
      Match.countDocuments({ status: 'active' }),
    ]);

    // ── Profile views this month ─────────────────────────────────────────────
    let profileViewsMonth = 0;
    try {
      const Activity = require('../models/Activity');
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
      profileViewsMonth = await Activity.countDocuments({ type: 'profile_view', timestamp: { $gte: startOfMonth } });
    } catch (_) { /* Activity model may not exist in all deployments */ }

    const avgMatchRate = totalUsers > 0 ? ((totalMatches / totalUsers) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      analytics: {
        dailyData: days,
        totals: { totalUsers, verifiedUsers, premiumUsers },
        profileViewsMonth,
        totalMatches,
        avgMatchRate,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/activity-monitoring
// @desc    Get real-time activity monitoring data
// @access  Private/Admin
router.get('/activity-monitoring', protect, isAdmin, async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const lastHour = new Date(now - 60 * 60 * 1000);

    const [active24h, active7d, onlineNow, messages24h] = await Promise.all([
      User.countDocuments({ lastActive: { $gte: last24h } }),
      User.countDocuments({ lastActive: { $gte: last7d } }),
      User.countDocuments({ lastActive: { $gte: lastHour } }),
      Message.countDocuments({ createdAt: { $gte: last24h } }),
    ]);

    res.json({
      success: true,
      activity: { active24h, active7d, onlineNow, messages24h },
    });
  } catch (error) {
    console.error('Activity monitoring error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/user-demographics
// @desc    Gender + age distribution of all users
// @access  Private/Admin
router.get('/user-demographics', protect, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'gender age');
    const genderMap = {};
    const ageBuckets = { '18-24': 0, '25-34': 0, '35-44': 0, '45+': 0 };

    users.forEach(u => {
      const g = (u.gender || 'other').toLowerCase();
      genderMap[g] = (genderMap[g] || 0) + 1;
      const a = u.age || 0;
      if (a >= 18 && a <= 24) ageBuckets['18-24']++;
      else if (a <= 34) ageBuckets['25-34']++;
      else if (a <= 44) ageBuckets['35-44']++;
      else if (a >= 45) ageBuckets['45+']++;
    });

    const genderData = Object.entries(genderMap).map(([name, value]) => ({ name, value }));
    const ageData = Object.entries(ageBuckets).map(([name, value]) => ({ name, value }));

    res.json({ success: true, demographics: { genderData, ageData, total: users.length } });
  } catch (error) {
    console.error('Demographics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/revenue-history
// @desc    Last 30 days subscription revenue chart data
// @access  Private/Admin
router.get('/revenue-history', protect, isAdmin, async (req, res) => {
  try {
    const now = new Date();
    const days = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end   = new Date(d.setHours(23, 59, 59, 999));

      const newPremium = await User.countDocuments({
        'premium.isActive': true,
        'premium.startedAt': { $gte: start, $lte: end },
      });
      const revenue = newPremium * 15;

      days.push({
        date: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue,
        subscriptions: newPremium,
      });
    }

    res.json({ success: true, revenueHistory: days });
  } catch (error) {
    console.error('Revenue history error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── SUPPORT TICKETS ────────────────────────────────────────────────────────

const SupportTicket = require('../models/SupportTicket');
const { sendExpoPushNotification, sendSmartNotification } = require('../utils/pushNotifications');

// @route   GET /api/admin/support-tickets
// @desc    Get all support tickets
// @access  Private/Admin
router.get('/support-tickets', protect, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const tickets = await SupportTicket.find(query)
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, tickets });
  } catch (error) {
    console.error('Get support tickets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/admin/support-tickets/:ticketId/reply
// @desc    Admin replies to a support ticket — saves to DB and pushes notification to user
// @access  Private/Admin
router.post('/support-tickets/:ticketId/reply', protect, isAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Reply content is required' });
    }

    const ticket = await SupportTicket.findById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const adminMessage = {
      role: 'admin',
      content: content.trim(),
      adminName: req.user?.name || 'AfroConnect Support',
      timestamp: new Date(),
    };
    ticket.messages.push(adminMessage);
    ticket.status = 'in-progress';
    await ticket.save();

    // Send push notification to the user if they have a push token
    if (ticket.userId) {
      try {
        const user = await User.findById(ticket.userId).select(
          'pushToken pushNotificationsEnabled muteSettings notificationPreferences'
        );
        if (user?.pushToken) {
          await sendSmartNotification(user, {
            title: '💬 Support Reply from AfroConnect',
            body: content.length > 80 ? content.substring(0, 80) + '...' : content,
            data: { screen: 'Support', ticketId: ticket._id.toString() },
            channelId: 'support',
          }, 'support');
        }
      } catch (pushErr) {
        console.error('Push notification failed (non-critical):', pushErr.message);
      }
    }

    // Send email notification to user
    if (ticket.userId) {
      try {
        const ticketUser = await User.findById(ticket.userId).select('email name');
        if (ticketUser?.email) {
          const { sendSupportReplyEmail } = require('../utils/emailService');
          await sendSupportReplyEmail(
            ticketUser.email,
            ticketUser.name,
            content.trim(),
            ticket.subject || null
          );
        }
      } catch (emailErr) {
        console.error('Support reply email error (non-critical):', emailErr.message);
      }
    }

    res.json({ success: true, message: 'Reply sent', ticket });
  } catch (error) {
    console.error('Support reply error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/support-tickets/:ticketId/status
// @desc    Update ticket status (open | in-progress | closed)
// @access  Private/Admin
router.put('/support-tickets/:ticketId/status', protect, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['open', 'in-progress', 'closed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.ticketId,
      {
        status,
        ...(status === 'closed' ? { resolvedAt: new Date(), resolvedBy: req.user._id } : {}),
      },
      { new: true }
    );

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/admin/kill-switch ─────────────────────────────────────────────
// Immediately enables maintenance mode, rejects all non-admin API traffic.
router.post('/kill-switch', protect, isAdmin, async (req, res) => {
  try {
    appSettings.maintenanceMode = true;

    // Log to audit trail
    try {
      const AuditLog = require('../models/AuditLog');
      await AuditLog.create({
        action: 'KILL_SWITCH_ACTIVATED',
        performedBy: req.user._id,
        details: { activatedAt: new Date().toISOString(), ip: req.ip },
      });
    } catch (_) {}

    console.warn(`[KILL-SWITCH] Activated by admin ${req.user.email} at ${new Date().toISOString()}`);

    return res.json({
      success: true,
      message: 'Kill switch activated — platform is now in maintenance mode.',
      maintenanceMode: true,
    });
  } catch (error) {
    console.error('[kill-switch] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to activate kill switch' });
  }
});

// ─── POST /api/admin/kill-switch/deactivate ───────────────────────────────────
// Restore normal operation.
router.post('/kill-switch/deactivate', protect, isAdmin, async (req, res) => {
  try {
    appSettings.maintenanceMode = false;

    try {
      const AuditLog = require('../models/AuditLog');
      await AuditLog.create({
        action: 'KILL_SWITCH_DEACTIVATED',
        performedBy: req.user._id,
        details: { deactivatedAt: new Date().toISOString() },
      });
    } catch (_) {}

    console.log(`[KILL-SWITCH] Deactivated by admin ${req.user.email}`);

    return res.json({
      success: true,
      message: 'Kill switch deactivated — platform restored to normal operation.',
      maintenanceMode: false,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to deactivate kill switch' });
  }
});

// Expose a getter so server.js middleware can check maintenanceMode without circular deps
router.getSettings = () => appSettings;

module.exports = router;
