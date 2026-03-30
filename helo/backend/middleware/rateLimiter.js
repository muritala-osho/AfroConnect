const rateLimit = require('express-rate-limit');

const apiLimiter = (req, res, next) => next();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false, 
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  }
});

const uploadLimiter = (req, res, next) => next();

const messageLimiter = (req, res, next) => next();

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  messageLimiter
};
