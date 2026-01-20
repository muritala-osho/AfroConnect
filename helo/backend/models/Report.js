
const mongoose = require('mongoose');

// Report Schema
const reportSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide the user ID of the reporter'],
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide the user ID of the reported user'],
  },
  reason: {
    type: String,
    required: [true, 'Please provide a reason for the report'],
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved'],
    default: 'pending'
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  adminNotes: String
}, {
  timestamps: true
});

reportSchema.pre(/^find/, function (next) {
  this.populate('reportedBy').populate('reportedUser');
  next();
});

module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);
