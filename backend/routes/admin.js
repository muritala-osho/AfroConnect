const logger = require('../utils/logger');

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Report = require('../models/Report');
const Match = require('../models/Match');
const Message = require('../models/Message');
const Story = require('../models/Story');
const AuditLog = require('../models/AuditLog');
const AdminPushSubscription = require('../models/AdminPushSubscription');
const redis = require('../utils/redis');
const verificationController = require('../controllers/verificationController');
const { sendAdminPushNotification, VAPID_PUBLIC_KEY } = require('../services/adminPushService');

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
    if (action === 'SAFETY_WARNING_BYPASSED') {
      sendAdminPushNotification({
        type: 'SAFETY_BYPASS',
        body: `${req.user.name} bypassed a safety warning${targetUser ? ` while messaging ${targetUser.name}` : ''}. Review immediately.`,
        data: { tab: 'content' },
      }).catch(() => {});
    } else if (severity === 'high' && !['SAFETY_ACTION_TAKEN', 'SAFETY_DISMISSED', 'REMOVE_CONTENT', 'APPROVE_CONTENT'].includes(action)) {
      sendAdminPushNotification({
        type: 'HIGH_SEVERITY',
        body: details || `A high-severity event occurred: ${action}`,
        data: { tab: 'audit' },
      }).catch(() => {});
    }
  } catch (e) {
    logger.error('[AuditLog] Failed to write audit entry:', e.message);
  }
};

const isAdmin = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

router.get('/push-vapid-key', protect, isAdmin, (req, res) => {
  res.json({ success: true, publicKey: VAPID_PUBLIC_KEY });
});

router.post('/push-subscribe', protect, isAdmin, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: 'Invalid subscription object' });
    }
    await AdminPushSubscription.findOneAndUpdate(
      { endpoint },
      { adminId: req.user._id, adminEmail: req.user.email, endpoint, keys, userAgent: req.headers['user-agent'], lastUsed: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Push subscription saved' });
  } catch (error) {
    logger.error('Push subscribe error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/push-unsubscribe', protect, isAdmin, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await AdminPushSubscription.deleteOne({ endpoint });
    } else {
      await AdminPushSubscription.deleteMany({ adminId: req.user._id });
    }
    res.json({ success: true, message: 'Unsubscribed from push notifications' });
  } catch (error) {
    logger.error('Push unsubscribe error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/push-test', protect, isAdmin, async (req, res) => {
  try {
    await sendAdminPushNotification({
      type: 'HIGH_SEVERITY',
      body: 'This is a test notification from AfroConnect Admin.',
      data: { tab: 'dashboard' },
      targetAdminId: req.user._id,
    });
    res.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/badge-counts', protect, isAdmin, async (req, res) => {
  try {
    const SupportTicket = require('../models/SupportTicket');
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [reports, verifications, appeals, safetyBypasses, openTickets, unreadTickets] = await Promise.all([
      Report.countDocuments({ status: 'pending' }),
      User.countDocuments({ verificationStatus: 'pending' }),
      User.countDocuments({ 'appeal.status': 'pending', isBanned: true }),
      AuditLog.countDocuments({ action: 'SAFETY_WARNING_BYPASSED', createdAt: { $gte: since24h } }),
      SupportTicket.countDocuments({ status: 'open' }).catch(() => 0),
      SupportTicket.countDocuments({ status: 'open', unreadByAgent: { $gt: 0 } }).catch(() => 0),
    ]);
    const flaggedContent = reports + safetyBypasses;
    res.json({
      success: true,
      counts: {
        reports,
        verifications,
        appeals,
        content: flaggedContent,
        tickets: openTickets,
        unreadTickets,
      },
    });
  } catch (error) {
    logger.error('Badge counts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/reports', protect, isAdmin, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const query = status === 'all' ? {} : { status };
    
    const reports = await Report.find(query)
      .populate('reporter', 'name email')
      .populate('reportedUser', 'name email photos')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    logger.error('Get reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

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
        } catch (e) { logger.error('Warning email failed:', e.message); }
      } else if (action === 'suspend') {
        reportedUser.suspended = true;
        reportedUser.suspendedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
        await reportedUser.save();
        try {
          const { sendSuspensionEmail } = require('../utils/emailService');
          await sendSuspensionEmail(reportedUser.email, reportedUser.name, notes || 'Repeated violation of community guidelines', 7);
        } catch (e) { logger.error('Suspension email failed:', e.message); }
      } else if (action === 'ban') {
        reportedUser.banned = true;
        reportedUser.bannedAt = Date.now();
        reportedUser.banReason = notes;
        await reportedUser.save();
        try {
          const { sendBanNotificationEmail } = require('../utils/emailService');
          await sendBanNotificationEmail(reportedUser.email, reportedUser.name, notes || 'Violation of community guidelines');
        } catch (e) { logger.error('Ban email failed:', e.message); }
      }

      try {
        const ioInstance = req.app.get('io');
        if (ioInstance) {
          const uid = reportedUser._id.toString();
          if (action === 'ban') {
            ioInstance.to(uid).emit('user:banned', {
              reason: notes || 'Violation of community guidelines',
              bannedAt: reportedUser.bannedAt,
            });
            await redis.del(`profile:me:${uid}`);
          } else if (action === 'suspend') {
            ioInstance.to(uid).emit('user:suspended', {
              reason: notes || 'Repeated violation of community guidelines',
              suspendedUntil: reportedUser.suspendedUntil,
            });
            await redis.del(`profile:me:${uid}`);
          }
        }
      } catch (socketErr) {
        logger.error('Failed to emit moderation socket event:', socketErr.message);
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
    logger.error('Resolve report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

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
    logger.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    await redis.del(`profile:me:${user._id}`);

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
      logger.error('Failed to emit ban socket event:', socketError);
    }

    try {
      const { sendBanNotificationEmail, sendUnbanNotificationEmail } = require('../utils/emailService');
      
      if (banned) {
        await sendBanNotificationEmail(user.email, user.name, reason || 'Violation of community guidelines');
      } else {
        await sendUnbanNotificationEmail(user.email, user.name);
      }
    } catch (emailError) {
      logger.error('Failed to send ban/unban notification email:', emailError);
    }

    await logAudit(req, banned ? 'BAN_USER' : 'UNBAN_USER', 'USER_MANAGEMENT', banned ? 'critical' : 'medium', user,
      banned ? `User banned. Reason: ${reason || 'Violation of community guidelines'}` : 'User ban lifted');

    res.json({
      success: true,
      message: banned ? 'User banned and notified' : 'User unbanned and notified',
      user
    });
  } catch (error) {
    logger.error('Ban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});


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
    await redis.del(`profile:me:${user._id}`);
    res.json({ success: true, message: `Verification ${action}d`, user });
  } catch (error) {
    logger.error('Update verification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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

    if (user.appeal && user.appeal.status === 'pending') {
      return res.status(400).json({ success: false, message: 'You already have a pending appeal' });
    }

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
    await redis.del(`profile:me:${user._id}`);

    sendAdminPushNotification({
      type: 'NEW_APPEAL',
      body: `${user.name} has submitted a ban appeal and is awaiting your review.`,
      data: { tab: 'appeals' },
    }).catch(() => {});

    res.json({ success: true, message: 'Appeal submitted successfully. Admins will review it soon.' });
  } catch (error) {
    logger.error('Appeal submission error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/appeals', protect, isAdmin, async (req, res) => {
  try {
    const appeals = await User.find({ 'appeal.status': 'pending' })
      .select('name email banned suspended appeal bannedAt suspendedUntil')
      .sort({ 'appeal.submittedAt': -1 })
      .limit(100);

    res.json({ success: true, appeals });
  } catch (error) {
    logger.error('Get appeals error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
      user.banned = false;
      user.bannedAt = null;
      user.banReason = null;
      user.suspended = false;
      user.suspendedUntil = null;
      user.messagingPaused = {
        isPaused: false,
        until: null,
        reason: null,
        autoTriggeredAt: null,
        bypassCount: 0,
      };
      user.appeal = {
        status: 'none',
        message: null,
        submittedAt: null,
        reviewedAt: Date.now(),
        reviewedBy: req.user._id,
        adminResponse: adminResponse || '',
        lastAppealRejectedAt: user.appeal.lastAppealRejectedAt || null
      };
    }

    await user.save();
    await redis.del(`profile:me:${user._id}`);

    try {
      const { sendAppealDecisionEmail } = require('../utils/emailService');
      const approved = action === 'approve';
      await sendAppealDecisionEmail(user.email, user.name, approved, adminResponse);
    } catch (emailError) {
      logger.error('Failed to send appeal decision email:', emailError);
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
    logger.error('Review appeal error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Lift an auto-triggered messaging pause after admin review
router.post('/users/:userId/lift-messaging-pause', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.messagingPaused = {
      isPaused: false,
      until: null,
      reason: null,
      autoTriggeredAt: null,
      bypassCount: 0,
    };
    await user.save();

    try {
      const ioInstance = req.app.get('io');
      if (ioInstance) {
        ioInstance.to(String(user._id)).emit('user:messaging-resumed', {});
      }
    } catch (_e) { /* non-fatal */ }

    await logAudit(req, 'LIFT_MESSAGING_PAUSE', 'USER_SAFETY', 'medium', user,
      'Admin lifted auto-triggered messaging pause');

    res.json({ success: true, message: 'Messaging pause lifted' });
  } catch (error) {
    logger.error('Lift messaging pause error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    logger.error('Get verifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/revoke-verification/:userId', protect, isAdmin, verificationController.revokeVerification);

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
    await redis.del(`profile:me:${user._id}`);

    await logAudit(req, 'APPROVE_VERIFICATION', 'VERIFICATION', 'medium', user, `ID verification approved for ${user.name}`);

    res.json({
      success: true,
      message: 'User verified successfully',
      user: { _id: user._id, name: user.name, email: user.email, verified: true }
    });
  } catch (error) {
    logger.error('Approval error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    await redis.del(`profile:me:${user._id}`);

    await logAudit(req, 'REJECT_VERIFICATION', 'VERIFICATION', 'medium', user,
      `ID verification rejected. Reason: ${reason || 'Photos do not meet requirements'}`);

    res.json({
      success: true,
      message: 'Verification rejected'
    });
  } catch (error) {
    logger.error('Rejection error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.get('/premium-members', protect, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 25, search, source, plan, status, autoRenew } = req.query;
    const query = { 'premium.isActive': true };

    if (status === 'expired') {
      query['premium.isActive'] = false;
      query['premium.cancelledAt'] = { $ne: null };
    } else if (status === 'expiring_soon') {
      const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      query['premium.expiresAt'] = { $lte: sevenDays, $gt: new Date() };
    } else if (status === 'cancelled_active') {
      query['premium.cancelledAt'] = { $ne: null };
      query['premium.isActive'] = true;
    }

    if (source) query['premium.source'] = source;
    if (plan) query['premium.plan'] = plan;
    if (autoRenew === 'true') query['premium.autoRenewing'] = true;
    if (autoRenew === 'false') query['premium.autoRenewing'] = false;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'premium.originalTransactionId': search },
        { 'premium.purchaseToken': search }
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [members, total, summaryAgg] = await Promise.all([
      User.find(query)
        .select('name email avatar premium createdAt')
        .sort({ 'premium.expiresAt': 1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean(),
      User.countDocuments(query),
      User.aggregate([
        { $match: { 'premium.isActive': true } },
        {
          $group: {
            _id: null,
            totalActive: { $sum: 1 },
            ios: { $sum: { $cond: [{ $eq: ['$premium.source', 'ios'] }, 1, 0] } },
            android: { $sum: { $cond: [{ $eq: ['$premium.source', 'android'] }, 1, 0] } },
            web: { $sum: { $cond: [{ $eq: ['$premium.source', 'web'] }, 1, 0] } },
            cancelledButActive: { $sum: { $cond: [{ $ne: ['$premium.cancelledAt', null] }, 1, 0] } },
            autoRenewOff: { $sum: { $cond: [{ $eq: ['$premium.autoRenewing', false] }, 1, 0] } }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      members,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      summary: summaryAgg[0] || {
        totalActive: 0, ios: 0, android: 0, web: 0,
        cancelledButActive: 0, autoRenewOff: 0
      }
    });
  } catch (error) {
    logger.error('Premium members error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Grant a user free Premium access (admin comp / VIP / influencer / refund credit etc.)
// POST /admin/users/:userId/grant-premium  { plan: 'gold'|'platinum'|'plus', durationDays: number, reason?: string }
router.post('/users/:userId/grant-premium', protect, isAdmin, async (req, res) => {
  try {
    const { plan = 'platinum', durationDays = 30, reason } = req.body || {};
    const allowedPlans = ['plus', 'gold', 'platinum'];
    if (!allowedPlans.includes(plan)) {
      return res.status(400).json({ success: false, message: `Plan must be one of: ${allowedPlans.join(', ')}` });
    }
    const days = Math.max(1, Math.min(3650, parseInt(durationDays, 10) || 30));

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const now = new Date();
    // If already active, extend from current expiry; otherwise from now.
    const currentExpiry = user.premium?.expiresAt ? new Date(user.premium.expiresAt) : null;
    const baseDate = user.premium?.isActive && currentExpiry && currentExpiry > now ? currentExpiry : now;
    const expiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    const features = {
      unlimitedSwipes: true,
      seeWhoLikesYou: true,
      unlimitedRewinds: true,
      boostPerMonth: plan === 'platinum' ? 10 : plan === 'gold' ? 5 : 1,
      superLikesPerDay: plan === 'platinum' ? 10 : plan === 'gold' ? 5 : 3,
      noAds: true,
      advancedFilters: true,
      readReceipts: true,
      priorityMatches: plan !== 'plus',
      incognitoMode: plan === 'platinum',
      voiceNoteLimit: 30,
      unsendLimit: 15,
    };

    user.premium = {
      ...(user.premium?.toObject ? user.premium.toObject() : user.premium || {}),
      isActive: true,
      plan,
      source: 'admin',
      productId: `admin_grant_${plan}`,
      expiresAt,
      activatedAt: user.premium?.activatedAt || now,
      cancelledAt: null,
      autoRenewing: false,
      lastEventType: 'ADMIN_GRANT',
      lastEventAt: now,
      features,
    };

    await user.save();
    if (redis?.del) {
      await redis.del(`profile:me:${user._id}`).catch(() => {});
    }

    await logAudit(
      req,
      'GRANT_PREMIUM',
      'SUBSCRIPTION',
      'high',
      user,
      `Granted ${plan} for ${days} days (until ${expiresAt.toISOString()})${reason ? ` — ${reason}` : ''}`
    );

    res.json({
      success: true,
      message: `${plan} premium granted for ${days} days`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        premium: user.premium,
      },
    });
  } catch (error) {
    logger.error('Grant premium error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Revoke a previously-granted free premium (only valid when source==='admin').
router.post('/users/:userId/revoke-premium', protect, isAdmin, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.premium?.source && user.premium.source !== 'admin') {
      return res.status(400).json({
        success: false,
        message: `Cannot revoke a paid subscription (source: ${user.premium.source}). Use the store cancellation flow instead.`,
      });
    }

    const now = new Date();
    user.premium = {
      ...(user.premium?.toObject ? user.premium.toObject() : user.premium || {}),
      isActive: false,
      plan: 'free',
      expiresAt: now,
      cancelledAt: now,
      autoRenewing: false,
      lastEventType: 'ADMIN_REVOKE',
      lastEventAt: now,
      features: {
        unlimitedSwipes: false,
        seeWhoLikesYou: false,
        unlimitedRewinds: false,
        boostPerMonth: 0,
        superLikesPerDay: 0,
        noAds: false,
        advancedFilters: false,
        readReceipts: false,
        priorityMatches: false,
        incognitoMode: false,
        voiceNoteLimit: 30,
        unsendLimit: 15,
      },
    };

    await user.save();
    if (redis?.del) {
      await redis.del(`profile:me:${user._id}`).catch(() => {});
    }

    await logAudit(
      req,
      'REVOKE_PREMIUM',
      'SUBSCRIPTION',
      'high',
      user,
      `Revoked admin-granted premium${reason ? ` — ${reason}` : ''}`
    );

    res.json({
      success: true,
      message: 'Premium revoked',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        premium: user.premium,
      },
    });
  } catch (error) {
    logger.error('Revoke premium error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Lightweight user lookup for the "Grant Premium" admin modal.
// GET /admin/users/lookup?q=email_or_name
router.get('/users/lookup', protect, isAdmin, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, users: [] });

    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safe = escape(q);
    const users = await User.find({
      $or: [
        { email: { $regex: safe, $options: 'i' } },
        { name: { $regex: safe, $options: 'i' } },
      ],
    })
      .select('name email avatar premium')
      .limit(10)
      .lean();

    res.json({ success: true, users });
  } catch (error) {
    logger.error('User lookup error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


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
    logger.error('Subscription error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


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
    logger.error('Stories moderation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    logger.error('Boosts error:', error);
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
    logger.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

router.get('/proxy-profile/:userId', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/users/:userId', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Get user detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    logger.error('Delete story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
      logger.error('Failed to emit suspend socket event:', socketError);
    }

    await logAudit(req, suspended ? 'SUSPEND_USER' : 'UNSUSPEND_USER', 'USER_MANAGEMENT', 'high', user,
      suspended ? `User suspended for ${days} days` : 'User suspension lifted');

    res.json({
      success: true,
      message: suspended ? `User suspended for ${days} days` : 'User suspension lifted',
      user,
    });
  } catch (error) {
    logger.error('Suspend user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/users/:userId', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logAudit(req, 'DELETE_USER', 'USER_MANAGEMENT', 'critical', user, `User account permanently deleted: ${user.name} (${user.email})`);
    await User.findByIdAndDelete(req.params.userId);
    res.json({ success: true, message: 'User account permanently deleted' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/flagged-content', protect, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    const FLAGGABLE_TYPES = [
      'profile_photo', 'story', 'message_image', 'message_text', 'message_audio',
      'message_video', 'voice_bio', 'success_story', 'bio', 'comment'
    ];
    const [reports, safetyAudits] = await Promise.all([
      Report.find({ status: 'pending', contentType: { $in: FLAGGABLE_TYPES } })
        .populate('reportedBy', 'name email photos')
        .populate('reporter', 'name email photos')
        .populate('reportedUser', 'name email photos')
        .sort({ createdAt: -1 })
        .limit(100),
      AuditLog.find({ action: 'SAFETY_WARNING_BYPASSED' })
        .populate('adminId', 'name email photos')
        .sort({ createdAt: -1 })
        .limit(50),
    ]);

    const VISUAL_TYPES = ['profile_photo', 'story', 'message_image', 'success_story'];
    const reportContent = reports
      .map(report => {
        const reportedUser = report.reportedUser;
        const reporter = report.reportedBy || report.reporter;
        if (!reportedUser) return null;
        const userAvatar = reportedUser.photos?.[0]?.url || reportedUser.photos?.[0];
        let imageUrl = report.contentUrl || (VISUAL_TYPES.includes(report.contentType) ? userAvatar : null);
        if (report.contentType === 'profile_photo' && !imageUrl) {
          const photoIndex = Number.parseInt(report.contentId || '0', 10);
          const photo = reportedUser.photos?.[photoIndex] || reportedUser.photos?.[0];
          imageUrl = photo?.url || photo;
        }

        return {
          id: `report-${report._id}`,
          reportId: report._id,
          userId: reportedUser._id,
          userName: reportedUser.name || 'Unknown user',
          userAvatar,
          type: report.contentType,
          imageUrl,
          contentUrl: report.contentUrl,
          contentPreview: report.contentPreview,
          contentMeta: report.contentMeta,
          reason: `${report.reason || 'Reported content'}${report.description ? `: ${report.description}` : ''}${reporter?.name ? ` • reported by ${reporter.name}` : ''}`,
          flaggedAt: report.createdAt || new Date(),
          status: 'pending',
          aiConfidence: 60,
        };
      })
      .filter(Boolean);

    const safetyContent = safetyAudits.map(audit => {
      const sender = audit.adminId;
      const reasons = audit.metadata?.reasons || [];
      const userAvatar = sender?.photos?.[0]?.url || sender?.photos?.[0] || null;
      return {
        id: `safety-${audit._id}`,
        auditId: audit._id,
        userId: sender?._id || audit.adminId,
        userName: audit.adminName || sender?.name || 'Unknown user',
        userAvatar,
        type: 'safety_bypass',
        imageUrl: null,
        contentPreview: audit.details || '',
        reason: `Safety warning bypassed: ${reasons.join(', ') || 'unknown reasons'}`,
        flaggedAt: audit.createdAt || new Date(),
        status: 'pending',
        severity: audit.severity,
        aiConfidence: audit.severity === 'high' ? 85 : 50,
      };
    });

    const content = [...reportContent, ...safetyContent].sort(
      (a, b) => new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime()
    );

    const filtered = status ? content.filter(c => c.status === status) : content;

    res.json({ success: true, content: filtered, total: filtered.length });
  } catch (error) {
    logger.error('Flagged content error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/flagged-content/:contentId', protect, isAdmin, async (req, res) => {
  try {
    const { action } = req.body; // 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    if (req.params.contentId.startsWith('safety-')) {
      const auditId = req.params.contentId.replace('safety-', '');
      const audit = await AuditLog.findById(auditId);
      if (!audit) {
        return res.status(404).json({ success: false, message: 'Safety audit record not found' });
      }
      if (action === 'reject') {
        const targetUser = await User.findById(audit.adminId);
        if (targetUser) {
          const suspendUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          targetUser.isBanned = true;
          targetUser.bannedAt = new Date();
          targetUser.banReason = 'Suspended by moderation after safety warning bypass review';
          targetUser.suspendedUntil = suspendUntil;
          await targetUser.save();
          const io = req.app.get('io');
          if (io) {
            io.to(String(targetUser._id)).emit('user:suspended', {
              days: 7,
              reason: 'Your account has been suspended after a safety review.',
              suspendedUntil: suspendUntil,
            });
          }
        }
      }
      await logAudit(req, action === 'reject' ? 'SAFETY_ACTION_TAKEN' : 'SAFETY_DISMISSED', 'USER_SAFETY',
        action === 'reject' ? 'high' : 'low', null,
        `Safety bypass ${action}d. Audit ID: ${auditId}`);
      return res.json({ success: true, message: action === 'approve' ? 'Safety event dismissed' : 'User suspended for safety violation', contentId: req.params.contentId, action });
    }

    if (req.params.contentId.startsWith('report-')) {
      const reportId = req.params.contentId.replace('report-', '');
      const report = await Report.findById(reportId);
      if (!report) {
        return res.status(404).json({ success: false, message: 'Flagged report not found' });
      }

      const reportedUserId = report.reportedUser?._id || report.reportedUser;
      const user = await User.findById(reportedUserId);
      if (action === 'reject') {
        if (report.contentType === 'profile_photo' && user) {
          let photoIndex = Number.parseInt(report.contentId || '', 10);
          if (!Number.isInteger(photoIndex) || !user.photos?.[photoIndex]) {
            photoIndex = user.photos?.findIndex(photo => (photo?.url || photo) === report.contentUrl) ?? -1;
          }
          if (photoIndex >= 0 && user.photos?.[photoIndex]) {
            user.photos.splice(photoIndex, 1);
            await user.save();
            await redis.del(`profile:me:${user._id}`);
          }
        } else if (report.contentType === 'story' && report.contentId) {
          const story = await Story.findById(report.contentId);
          if (story) {
            const ownerId = story.user.toString();
            await story.deleteOne();
            await Promise.all([
              redis.del(`stories:active:${ownerId}`),
              redis.del(`stories:mine:${ownerId}`),
              redis.del(`stories:user:${ownerId}:viewer:${ownerId}`),
            ]);
          }
        } else if (['message_image', 'message_text', 'message_audio', 'message_video'].includes(report.contentType) && report.contentId) {
          const message = await Message.findById(report.contentId);
          if (message) {
            message.content = 'This message was removed by moderation';
            message.type = 'system';
            message.imageUrl = undefined;
            message.audioUrl = undefined;
            message.videoUrl = undefined;
            message.deletedForEveryone = true;
            await message.save();
            const io = req.app.get('io');
            if (io) {
              io.to(message.matchId.toString()).emit('chat:message-deleted', {
                messageId: message._id,
                matchId: message.matchId,
              });
            }
          }
        } else if (report.contentType === 'voice_bio' && user) {
          if (user.voiceBio?.url) {
            user.voiceBio = { url: null, publicId: null };
            await user.save();
            await redis.del(`profile:me:${user._id}`);
          }
        } else if (report.contentType === 'bio' && user) {
          if (user.bio) {
            user.bio = '';
            await user.save();
            await redis.del(`profile:me:${user._id}`);
          }
        } else if (report.contentType === 'success_story' && report.contentId) {
          const SuccessStory = require('../models/SuccessStory');
          const story = await SuccessStory.findById(report.contentId);
          if (story) {
            story.status = 'rejected';
            story.rejectionReason = 'Removed by moderation following community report';
            story.featured = false;
            await story.save();
          }
        }
      }

      report.status = 'resolved';
      report.resolvedBy = req.user._id;
      report.resolvedAt = Date.now();
      report.adminNotes = action === 'approve' ? 'Content reviewed and kept' : 'Flagged content removed';
      await report.save();
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
    logger.error('Moderate content error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const broadcastHistory = [];

router.get('/broadcasts', protect, isAdmin, async (req, res) => {
  try {
    res.json({ success: true, broadcasts: broadcastHistory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/broadcasts', protect, isAdmin, async (req, res) => {
  try {
    const { sendSmartNotification } = require('../utils/pushNotifications');
    const { title, body, target = 'all', imageUrl, scheduled = false } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

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

    res.json({ success: true, message: 'Broadcast dispatched successfully', campaign });

    if (!scheduled) {
      setImmediate(async () => {
        const Notification = require('../models/Notification');
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
            await Notification.create({
              recipient: user._id,
              type: 'system',
              title,
              body,
              data: { type: 'broadcast', screen: 'Home' },
            });
          } catch (e) {
            logger.error('[Broadcast] Push error for user', user._id, e.message);
          }
        }
        campaign.actualSent = sent;
        logger.log(`[Broadcast] "${title}" — sent ${sent}/${reach} notifications`);
      });
    }
  } catch (error) {
    logger.error('Send broadcast error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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

router.get('/settings', protect, isAdmin, (req, res) => {
  res.json({ success: true, settings: appSettings });
});

router.put('/settings', protect, isAdmin, (req, res) => {
  try {
    const updates = req.body;
    appSettings = { ...appSettings, ...updates };
    res.json({ success: true, message: 'Settings updated successfully', settings: appSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/analytics', protect, isAdmin, async (req, res) => {
  try {
    const now = new Date();
    const period = req.query.period === '30d' ? '30d' : '7d';
    const dayCount = period === '30d' ? 30 : 7;

    const days = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);

      const [newUsers, activeUsers] = await Promise.all([
        User.countDocuments({ createdAt:  { $gte: start, $lte: end } }),
        User.countDocuments({ lastActive: { $gte: start, $lte: end } }),
      ]);

      days.push({
        name: period === '30d'
          ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : start.toLocaleDateString('en-US', { weekday: 'short' }),
        newUsers,
        active:   activeUsers,
        matches:  Math.floor(activeUsers * 0.25),
        messages: Math.floor(activeUsers * 2.1),
      });
    }

    const [totalUsers, verifiedUsers, premiumUsers, totalMatches] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ verified: true }),
      User.countDocuments({ 'premium.isActive': true }),
      Match.countDocuments({ status: 'active' }),
    ]);

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
    logger.error('Analytics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    logger.error('Activity monitoring error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/user-demographics', protect, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'gender age');
    const genderMap = {};
    const ageBuckets = { '18-24': 0, '25-34': 0, '35-44': 0, '45+': 0 };
    const normalizeGender = (gender) => {
      const value = String(gender || 'other').trim().toLowerCase();
      if (['male', 'man', 'men', 'm'].includes(value)) return 'male';
      if (['female', 'woman', 'women', 'f'].includes(value)) return 'female';
      if (['non-binary', 'nonbinary', 'non binary', 'nb'].includes(value)) return 'non-binary';
      return 'other';
    };

    users.forEach(u => {
      const g = normalizeGender(u.gender);
      genderMap[g] = (genderMap[g] || 0) + 1;
      const a = u.age || 0;
      if (a >= 18 && a <= 24) ageBuckets['18-24']++;
      else if (a <= 34) ageBuckets['25-34']++;
      else if (a <= 44) ageBuckets['35-44']++;
      else if (a >= 45) ageBuckets['45+']++;
    });

    const genderLabels = { male: 'Male', female: 'Female', 'non-binary': 'Non-binary', other: 'Other' };
    const genderData = Object.entries(genderMap).map(([name, value]) => ({ name: genderLabels[name] || name, value }));
    const ageData = Object.entries(ageBuckets).map(([name, value]) => ({ name, value }));

    res.json({ success: true, demographics: { genderData, ageData, total: users.length } });
  } catch (error) {
    logger.error('Demographics error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    logger.error('Revenue history error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


const SupportTicket = require('../models/SupportTicket');
const { sendExpoPushNotification, sendSmartNotification } = require('../utils/pushNotifications');

router.get('/support-tickets', protect, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const tickets = await SupportTicket.find(query)
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, tickets });
  } catch (error) {
    logger.error('Get support tickets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
        logger.error('Push notification failed (non-critical):', pushErr.message);
      }
    }

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
        logger.error('Support reply email error (non-critical):', emailErr.message);
      }
    }

    res.json({ success: true, message: 'Reply sent', ticket });
  } catch (error) {
    logger.error('Support reply error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    logger.error('Update ticket status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/kill-switch', protect, isAdmin, async (req, res) => {
  try {
    appSettings.maintenanceMode = true;

    try {
      const AuditLog = require('../models/AuditLog');
      await AuditLog.create({
        action: 'KILL_SWITCH_ACTIVATED',
        performedBy: req.user._id,
        details: { activatedAt: new Date().toISOString(), ip: req.ip },
      });
    } catch (auditErr) { logger.warn('[kill-switch] Audit log failed (non-critical):', auditErr.message); }

    logger.warn(`[KILL-SWITCH] Activated by admin ${req.user._id} at ${new Date().toISOString()}`);

    return res.json({
      success: true,
      message: 'Kill switch activated — platform is now in maintenance mode.',
      maintenanceMode: true,
    });
  } catch (error) {
    logger.error('[kill-switch] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to activate kill switch' });
  }
});

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
    } catch (auditErr) { logger.warn('[kill-switch] Audit log failed (non-critical):', auditErr.message); }

    logger.log(`[KILL-SWITCH] Deactivated by admin ${req.user._id}`);

    return res.json({
      success: true,
      message: 'Kill switch deactivated — platform restored to normal operation.',
      maintenanceMode: false,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to deactivate kill switch' });
  }
});

router.getSettings = () => appSettings;

module.exports = router;
