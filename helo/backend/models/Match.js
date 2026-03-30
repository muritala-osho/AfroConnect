
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  matchedAt: {
    type: Date,
    default: Date.now
  },
  isSuperLike: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'unmatched', 'blocked'],
    default: 'active'
  },
  screenshotProtection: {
    type: Boolean,
    default: false
  },
  lastMessageAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

matchSchema.pre('save', async function() {
  if (this.users.length !== 2) {
    throw new Error('A match must have exactly 2 users');
  }
});

matchSchema.index({ users: 1 });
matchSchema.index({ matchedAt: -1 });
matchSchema.index({ users: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Match', matchSchema);
