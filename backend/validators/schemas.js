const Joi = require('joi');

// ─── Auth ────────────────────────────────────────────────────────────────────

const signup = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  password: Joi.string().min(6).max(128).required(),
  confirmPassword: Joi.string().optional().allow(''),
  name: Joi.string().trim().min(2).max(60).optional(),
  username: Joi.string().trim().min(2).max(40).optional().allow(''),
  age: Joi.number().integer().min(18).max(100).optional(),
  gender: Joi.string().valid('male', 'female', 'non-binary', 'other', 'man', 'woman', 'prefer_not_to_say').optional(),
  interestedIn: Joi.array().items(Joi.string().valid('male', 'female', 'everyone', 'non-binary', 'all')).default(['everyone']),
  location: Joi.object().optional(),
  referralCode: Joi.string().max(20).optional().allow(''),
});

const login = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  password: Joi.string().min(1).max(128).required(),
});

const verifyOtp = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
});

const forgotPassword = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
});

const resetPassword = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

// ─── Chat ────────────────────────────────────────────────────────────────────

const sendMessage = Joi.object({
  content: Joi.string().max(5000).when('type', { is: 'text', then: Joi.required(), otherwise: Joi.optional().allow('') }),
  type: Joi.string().valid('text', 'image', 'video', 'audio', 'file', 'location', 'system', 'call', 'story_reaction', 'story_reply').default('text'),
  imageUrl: Joi.string().uri().optional().allow(''),
  videoUrl: Joi.string().uri().optional().allow(''),
  audioUrl: Joi.string().uri().optional().allow(''),
  audioDuration: Joi.number().min(0).max(600).optional(),
  fileUrl: Joi.string().uri().optional().allow(''),
  fileName: Joi.string().max(255).optional().allow(''),
  fileSize: Joi.number().min(0).optional(),
  fileType: Joi.string().max(100).optional().allow(''),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  address: Joi.string().max(500).optional().allow(''),
  callStatus: Joi.string().valid('missed', 'ended', 'rejected').optional(),
  callType: Joi.string().valid('voice', 'video').optional(),
  viewOnce: Joi.boolean().optional(),
  replyTo: Joi.object({
    messageId: Joi.string().required(),
    content: Joi.string().max(500).required(),
    type: Joi.string().required(),
    senderName: Joi.string().max(100).required(),
  }).optional(),
});

// ─── Stories ─────────────────────────────────────────────────────────────────

const createStory = Joi.object({
  type: Joi.string().valid('image', 'video', 'text').required(),
  content: Joi.string().max(2000).optional().allow(''),
  textContent: Joi.string().max(500).optional().allow(''),
  backgroundColor: Joi.string().max(50).optional().allow(''),
  mediaUrl: Joi.string().uri().optional().allow(''),
  thumbnail: Joi.string().uri().optional().allow(''),
  durationHours: Joi.number().integer().min(1).max(720).optional(),
});

const storyReact = Joi.object({
  emoji: Joi.string().max(10).required(),
});

const storyReply = Joi.object({
  message: Joi.string().trim().min(1).max(1000).required(),
});

// ─── Reports ─────────────────────────────────────────────────────────────────

const report = Joi.object({
  reportedUserId: Joi.string().hex().length(24).required(),
  reason: Joi.string().valid('inappropriate', 'harassment', 'spam', 'fake', 'underage', 'scam', 'violence', 'hate', 'other').required(),
  details: Joi.string().max(2000).optional().allow(''),
  messageId: Joi.string().hex().length(24).optional(),
});

// ─── Match / Swipe ───────────────────────────────────────────────────────────

const swipe = Joi.object({
  targetUserId: Joi.string().hex().length(24).required(),
  action: Joi.string().valid('like', 'pass', 'superlike').required(),
});

// ─── Profile ─────────────────────────────────────────────────────────────────

const updateProfile = Joi.object({
  name: Joi.string().trim().min(2).max(60).optional(),
  bio: Joi.string().max(500).optional().allow(''),
  age: Joi.number().integer().min(18).max(100).optional(),
  gender: Joi.string().valid('male', 'female', 'non-binary', 'other').optional(),
  interestedIn: Joi.array().items(Joi.string()).optional(),
  interests: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  location: Joi.object().optional(),
  lifestyle: Joi.object().optional(),
  lookingFor: Joi.string().max(100).optional().allow(''),
  height: Joi.number().min(100).max(250).optional(),
  photos: Joi.array().optional(),
}).unknown(true);

module.exports = {
  auth: { signup, login, verifyOtp, forgotPassword, resetPassword },
  chat: { sendMessage },
  stories: { createStory, storyReact, storyReply },
  match: { swipe },
  report,
  updateProfile,
};
