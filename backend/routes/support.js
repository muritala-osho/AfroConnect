const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const SupportTicket = require('../models/SupportTicket');

// @route   POST /api/support/contact
// @desc    User submits a support ticket
// @access  Public / Private (userId optional)
router.post('/contact', async (req, res) => {
  try {
    const { name, email, message, subject, category, userId } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please fill in all fields' });
    }

    // Determine priority based on category
    const priorityMap = { billing: 'high', account: 'medium', technical: 'medium', safety: 'high', other: 'low' };
    const cat = category || 'other';

    // Create support ticket in DB
    const ticket = new SupportTicket({
      userId: userId || null,
      userName: name,
      userEmail: email,
      subject: subject || 'Support Request',
      category: cat,
      priority: priorityMap[cat] || 'medium',
      status: 'open',
      messages: [{ role: 'user', content: message, timestamp: new Date() }],
    });
    await ticket.save();

    // Also try to send email to admin (non-critical)
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
      await transporter.sendMail({
        from: email,
        to: process.env.EMAIL_USER || 'support@afroconnect.app',
        subject: `[AfroConnect Support] ${subject || 'New Ticket'} from ${name}`,
        text: `Ticket ID: ${ticket._id}\nUser: ${name} (${email})\nCategory: ${cat}\n\nMessage:\n${message}`,
      });
    } catch (emailErr) {
      console.error('Email notification failed (non-critical):', emailErr.message);
    }

    res.json({
      success: true,
      ticketId: ticket._id,
      message: 'Your message has been received! Our support team will reply within 24 hours.',
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/support/my-tickets
// @desc    Get logged-in user's support tickets with admin replies
// @access  Private
router.get('/my-tickets', protect, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(50);
    res.json({ success: true, tickets });
  } catch (error) {
    console.error('Get my tickets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/support/my-messages  (legacy compatibility)
router.get('/my-messages', protect, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id }).sort({ updatedAt: -1 }).limit(20);
    const messages = tickets.flatMap(t =>
      t.messages.map(m => ({
        id: m._id,
        ticketId: t._id,
        subject: t.subject,
        message: m.content,
        isFromAdmin: m.role === 'admin',
        adminName: m.adminName,
        createdAt: m.timestamp,
      }))
    );
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
