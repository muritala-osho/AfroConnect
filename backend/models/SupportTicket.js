const mongoose = require('mongoose');

// Individual message within a ticket thread
const messageSchema = new mongoose.Schema({
  // 'user' = from user, 'admin' = from admin, 'agent' = from support agent
  role: { type: String, enum: ['user', 'admin', 'agent'], required: true },
  content: { type: String, required: true },
  senderName: { type: String }, // display name of whoever sent the message
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Keep legacy adminName for backward compat with existing records
  adminName: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const supportTicketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    subject: { type: String, required: true },
    category: {
      type: String,
      enum: ['billing', 'account', 'technical', 'safety', 'other'],
      default: 'other',
    },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    // 'pending' = agent acknowledged but awaiting more info
    status: {
      type: String,
      enum: ['open', 'pending', 'in-progress', 'closed'],
      default: 'open',
    },
    messages: [messageSchema],

    // Which support agent is handling this ticket (null = unassigned)
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date },

    // Unread counters drive notification badges on each side
    unreadByUser: { type: Number, default: 0 }, // replies user hasn't read yet
    unreadByAgent: { type: Number, default: 0 }, // new user messages agent hasn't read

    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Efficient querying
supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ userId: 1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
