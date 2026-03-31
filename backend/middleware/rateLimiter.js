const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.'
  }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path.startsWith('/socket.io') || req.path.startsWith('/public');
  },
  message: {
    success: false,
    message: 'Too many requests, please slow down.'
  }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Upload limit reached. Please wait an hour before uploading more.'
  }
});

const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'You are sending messages too quickly. Please slow down.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  messageLimiter
};
