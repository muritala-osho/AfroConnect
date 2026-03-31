const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'admin'], required: true },
  content: { type: String, required: true },
  adminName: { type: String },
  timestamp: { type: Date, default: Date.now },
});

const supportTicketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  subject: { type: String, required: true },
  category: { type: String, enum: ['billing', 'account', 'technical', 'safety', 'other'], default: 'other' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, enum: ['open', 'in-progress', 'closed'], default: 'open' },
  messages: [messageSchema],
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ userId: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
