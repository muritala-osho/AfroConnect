
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const redis = require('../utils/redis');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized to access this route' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.sessionId) {
      const revoked = await redis.get(`revoked:${decoded.sessionId}`);
      if (revoked) {
        return res.status(401).json({
          success: false,
          message: 'This session has been revoked. Please log in again.',
          tokenRevoked: true,
        });
      }
      req.sessionId = decoded.sessionId;
    }

    req.user = await User.findById(decoded.id).select('+tokenVersion');

    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (req.user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.',
        tokenRevoked: true
      });
    }

    if (req.user.banned) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been banned',
        reason: req.user.banReason
      });
    }

    if (req.user.suspended && req.user.suspendedUntil > Date.now()) {
      // Issue a short-lived appeal token so the app can navigate to the appeal screen
      let appealToken = null;
      try {
        const jwt = require('jsonwebtoken');
        appealToken = jwt.sign(
          { id: req.user._id, purpose: 'appeal', email: req.user.email },
          process.env.JWT_SECRET,
          { expiresIn: '15m' },
        );
      } catch (_e) { /* non-fatal */ }
      return res.status(403).json({
        success: false,
        message: 'Your account is temporarily suspended',
        isSuspended: true,
        suspendedUntil: req.user.suspendedUntil,
        suspensionReason: req.user.banReason || 'Violation of community guidelines',
        email: req.user.email,
        appealToken,
        appeal: req.user.appeal || null,
      });
    }

    const allowedPaths = [
      '/api/auth/verify-otp',
      '/api/auth/resend-otp',
      '/api/user/upload-photo',
      '/api/user/me'
    ];
    
    const isAllowedPath = allowedPaths.some(path => req.originalUrl.startsWith(path));

    if (!req.user.emailVerified && !isAllowedPath) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email with the OTP sent to you.',
        needsVerification: true
      });
    }

    if (req.user.suspended && req.user.suspendedUntil <= Date.now()) {
      req.user.suspended = false;
      req.user.suspendedUntil = null;
      await req.user.save();
      try {
        const { sendSuspensionLiftedEmail } = require('../utils/emailService');
        await sendSuspensionLiftedEmail(req.user.email, req.user.name);
      } catch (emailErr) {
        console.error('Suspension lifted email error (non-critical):', emailErr.message);
      }
    }

    if (
      req.user.premium?.isActive &&
      req.user.premium?.expiresAt &&
      new Date(req.user.premium.expiresAt) < new Date()
    ) {
      req.user.premium.isActive = false;
      await User.findByIdAndUpdate(req.user._id, { 'premium.isActive': false });
    }

    if (req.sessionId) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      Session.updateOne(
        { sessionId: req.sessionId, lastActive: { $lt: fiveMinutesAgo } },
        { $set: { lastActive: new Date() } }
      ).catch(() => {});
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized to access this route' 
    });
  }
};

module.exports = { protect };
