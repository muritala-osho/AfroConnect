
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  plan: {
    type: String,
    enum: ['free', 'plus', 'premium'],
    default: 'free'
  },
  features: {
    unlimitedLikes: { type: Boolean, default: false },
    superLikesPerDay: { type: Number, default: 1 },
    rewind: { type: Boolean, default: false },
    passportMode: { type: Boolean, default: false },
    seeWhoLikesYou: { type: Boolean, default: false },
    priorityLikes: { type: Boolean, default: false },
    adFree: { type: Boolean, default: false }
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
