
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
  }
}, {
  timestamps: true
});

// Ensure users array has exactly 2 elements
matchSchema.pre('save', async function() {
  if (this.users.length !== 2) {
    throw new Error('A match must have exactly 2 users');
  }
});

// Index for faster queries
matchSchema.index({ users: 1 });
matchSchema.index({ matchedAt: -1 });

module.exports = mongoose.model('Match', matchSchema);
