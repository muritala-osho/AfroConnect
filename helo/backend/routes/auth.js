
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../utils/emailService');
const { authLimiter } = require('../middleware/rateLimiter');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// @route   POST /api/auth/signup
// @desc    Register new user and send OTP
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username, name, age, gender } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }

    // Check if username is taken
    if (username) {
      const usernameExists = await User.findOne({ username });
      if (usernameExists) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
    }

    // Check if user exists
    let existingUser = await User.findOne({ email });
    
    // If user exists and has verified their email, they should login instead
    if (existingUser && existingUser.emailVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists. Please login instead.' 
      });
    }
    
    // If user exists but email not verified (abandoned signup), delete and recreate
    if (existingUser && !existingUser.emailVerified) {
      await User.deleteOne({ _id: existingUser._id });
      console.log('Deleted unverified user for re-registration:', email);
    }

    // Generate OTP
    const { generateOTP, sendOTPEmail } = require('../utils/emailService');
    const otpCode = generateOTP();

    // Create user with minimal data - not verified yet
    const user = await User.create({
      name: name || 'User',
      username,
      email,
      password,
      age: age || 18,
      gender: gender || 'other',
      location: {
        type: 'Point',
        coordinates: [0, 0]  // Temporary location
      },
      verified: false,
      verificationOTP: otpCode,
      verificationOTPExpire: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    // Send OTP email
    try {
      await sendOTPEmail(email, 'User', otpCode);
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      // Continue anyway - user can request resend
    }

    res.status(201).json({
      success: true,
      message: 'Verification code sent to your email',
      userId: user._id,
      email: user.email
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error during signup' 
    });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and complete registration
// @access  Public
router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findOne({
      _id: userId,
      verificationOTP: otp,
      verificationOTPExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    user.emailVerified = true;
    user.verificationOTP = undefined;
    user.verificationOTPExpire = undefined;
    user.expireAt = undefined; // Stop auto-deletion once verified
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        age: user.age,
        gender: user.gender,
        isAdmin: user.isAdmin || false
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification'
    });
  }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
// @access  Public
router.post('/resend-otp', async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    const { generateOTP, sendOTPEmail } = require('../utils/emailService');
    const otpCode = generateOTP();

    user.verificationOTP = otpCode;
    user.verificationOTPExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendOTPEmail(user.email, user.name, otpCode);

    res.json({
      success: true,
      message: 'New verification code sent to your email'
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification code'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }

    // Check user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if user is banned
    if (user.banned) {
      // Generate a short-lived appeal token (15 minutes)
      const appealToken = jwt.sign(
        { id: user._id, purpose: 'appeal', email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been suspended. Please appeal in the app for more information.',
        isBanned: true,
        appealToken,
        email: user.email,
        banReason: user.banReason || 'Violation of community guidelines',
        bannedAt: user.bannedAt,
        appeal: user.appeal || null
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Update last active
    user.lastActive = Date.now();
    user.onlineStatus = 'online';
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        age: user.age,
        gender: user.gender,
        bio: user.bio,
        interests: user.interests,
        photos: user.photos,
        verified: user.verified,
        isAdmin: user.isAdmin || false,
        location: user.location,
        lookingFor: user.lookingFor,
        preferences: user.preferences,
        lifestyle: user.lifestyle,
        favoriteSong: user.favoriteSong
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset via OTP
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // For debugging
      console.log('[FORGOT_PASSWORD] No account found with email:', email);
      return res.status(404).json({ 
        success: false, 
        message: 'No account found with this email' 
      });
    }

    // Generate OTP for password reset
    const { generateOTP, sendOTPEmail } = require('../utils/emailService');
    const otpCode = generateOTP();
    
    user.resetPasswordOTP = otpCode;
    user.resetPasswordOTPExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    console.log('[FORGOT_PASSWORD] Generated OTP for:', email, 'OTP:', otpCode);

    // Send OTP email
    try {
      await sendOTPEmail(user.email, user.name, otpCode);
      res.json({
        success: true,
        message: 'Verification code sent to your email',
        userId: user._id
      });
    } catch (emailError) {
      console.error('Email failed:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send email. Please try again.'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Step 3: Reset password with OTP and new password
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, code, and new password'
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      $or: [
        { resetPasswordOTP: otp.toString().trim() },
        { verificationOTP: otp.toString().trim() }
      ],
      $or: [
        { resetPasswordOTPExpire: { $gt: Date.now() } },
        { verificationOTPExpire: { $gt: Date.now() } }
      ]
    });

    if (!user) {
      // Improved debugging
      const foundUser = await User.findOne({ email: email.toLowerCase() });
      if (foundUser) {
        const resetMatch = foundUser.resetPasswordOTP === otp.toString().trim();
        const verifyMatch = foundUser.verificationOTP === otp.toString().trim();
        const resetExpired = foundUser.resetPasswordOTPExpire <= Date.now();
        const verifyExpired = foundUser.verificationOTPExpire <= Date.now();
        console.log(`[RESET_PASSWORD] Failure details for ${email}:`, {
          providedOTP: otp,
          resetOTP: foundUser.resetPasswordOTP,
          verifyOTP: foundUser.verificationOTP,
          resetMatch,
          verifyMatch,
          resetExpired,
          verifyExpired,
          now: Date.now()
        });
      } else {
        console.log('[RESET_PASSWORD] User not found during verify:', email);
      }
      
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/appeal
// @desc    Submit a ban appeal
// @access  Public (via appeal token)
router.post('/appeal', async (req, res) => {
  try {
    const { appealToken, message } = req.body;

    if (!appealToken) {
      return res.status(401).json({ 
        success: false, 
        message: 'Appeal token is required' 
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Appeal message is required' 
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Appeal message must be under 1000 characters' 
      });
    }

    // Verify the appeal token
    let decoded;
    try {
      decoded = jwt.verify(appealToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired appeal token. Please try logging in again.' 
      });
    }

    // Ensure it's an appeal token
    if (decoded.purpose !== 'appeal') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token type' 
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!user.banned && !user.suspended) {
      return res.status(400).json({ 
        success: false, 
        message: 'You do not have an active ban or suspension to appeal' 
      });
    }

    // Check if already has pending appeal
    if (user.appeal && user.appeal.status === 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'You already have a pending appeal' 
      });
    }

    // Check 30-day cooldown after rejection ONLY
    if (user.appeal && user.appeal.status === 'rejected' && user.appeal.lastAppealRejectedAt) {
      const daysSinceRejection = (Date.now() - user.appeal.lastAppealRejectedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceRejection < 30) {
        const daysLeft = Math.ceil(30 - daysSinceRejection);
        return res.status(400).json({ 
          success: false, 
          message: `You can submit a new appeal in ${daysLeft} days` 
        });
      }
    }
    
    // Note: If appeal was accepted, user can appeal again if banned again later

    user.appeal = {
      status: 'pending',
      message,
      submittedAt: Date.now()
    };
    await user.save();

    res.json({ 
      success: true, 
      message: 'Appeal submitted successfully. Admins will review it soon.' 
    });
  } catch (error) {
    console.error('Appeal submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;
