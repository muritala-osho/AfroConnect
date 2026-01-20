
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
    console.log('Auth middleware - decoded token userId:', decoded.id);
    
    req.user = await User.findById(decoded.id);
    console.log('Auth middleware - user found:', !!req.user);
    
    if (!req.user) {
      console.log('Auth middleware - User not found for ID:', decoded.id);
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if user is banned
    if (req.user.banned) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been banned',
        reason: req.user.banReason
      });
    }

    // Check if user is suspended
    if (req.user.suspended && req.user.suspendedUntil > Date.now()) {
      return res.status(403).json({
        success: false,
        message: 'Your account is temporarily suspended',
        suspendedUntil: req.user.suspendedUntil
      });
    }

    // NEW: Check if user is verified (OTP)
    // We allow access to verification routes and essential profile setup (like photo upload)
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

    // Clear suspension if expired
    if (req.user.suspended && req.user.suspendedUntil <= Date.now()) {
      req.user.suspended = false;
      req.user.suspendedUntil = null;
      await req.user.save();
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
