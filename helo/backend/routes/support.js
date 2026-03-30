const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

const User = require('../models/User');
const Message = require('../models/Message');

// @route   POST /api/support/contact
// @desc    Handle contact form submissions
// @access  Public
router.post('/contact', async (req, res) => {
  try {
    const { name, email, message, userId } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Please fill in all fields' });
    }

    // 1. Create a support message in the database for the admin
    // In this architecture, we'll store it as a system message or a special Support message
    if (userId) {
      const supportMessage = new Message({
        sender: userId,
        content: `[CONTACT FORM] ${message}`,
        isSupport: true,
        metadata: { name, email }
      });
      await supportMessage.save();
    }

    // 2. Send email to admin
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER || 'davidnifemi755@gmail.com',
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: email,
      to: 'davidnifemi755@gmail.com',
      subject: `[AfroConnect Support] New Message from ${name}`,
      text: `User Name: ${name}\nUser Email: ${email}\nUser ID: ${userId || 'Guest'}\n\nMessage:\n${message}\n\n---\nThis message has been logged in the support system.`
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('❌ Email delivery failed:', emailError);
    }
    
    res.json({ success: true, message: 'Thank you for contacting us! Our support team will review your message and get back to you within 24 hours.' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/support/my-messages
// @desc    Get current user's support messages
// @access  Private
router.get('/my-messages', async (req, res) => {
  try {
    // In a real production app, we would query the database here.
    // For this MVP, we return mock data that matches the admin dashboard logic.
    const mockMessages = [
      {
        id: '1',
        subject: 'Welcome to Support',
        message: 'Hello! How can we help you today?',
        isFromAdmin: true,
        createdAt: new Date().toISOString()
      }
    ];
    res.json({ success: true, messages: mockMessages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;