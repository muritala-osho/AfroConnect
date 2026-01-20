const rateLimit = require('express-rate-limit');

// General API rate limiter - disabled as per user request (only for sign in/up)
const apiLimiter = (req, res, next) => next();

// Stricter limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Increased slightly for better UX
  skipSuccessfulRequests: false, // Apply to all auth attempts
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  }
});

// Upload limiter - disabled
const uploadLimiter = (req, res, next) => next();

// Message limiter - disabled
const messageLimiter = (req, res, next) => next();

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  messageLimiter
};
