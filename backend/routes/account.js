
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/Match');
const Message = require('../models/Message');
const Activity = require('../models/Activity');
const CallHistory = require('../models/CallHistory');
const FriendRequest = require('../models/FriendRequest');
const crypto = require('crypto');
const { sendOTP } = require('../utils/emailService');

// @route   DELETE /api/account/delete
// @desc    Permanently delete user account and all data
// @access  Private
router.delete('/delete', protect, async (req, res) => {
  try {
    const { password, reason } = req.body;
    
    const user = await User.findById(req.user._id).select('+password');
    
    // Verify password if user has one (not OAuth users)
    if (user.password && password) {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password'
        });
      }
    } else if (user.password && !password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account'
      });
    }
    
    // Log deletion reason for analytics
    console.log('Account deletion - User ID:', user._id, 'Reason:', reason);
    
    // Delete all user data
    await Promise.all([
      // Delete user profile
      User.deleteOne({ _id: user._id }),
      
      // Delete all matches
      Match.deleteMany({ users: user._id }),
      
      // Delete all messages sent by user
      Message.deleteMany({ sender: user._id }),
      
      // Delete messages in conversations with user
      Message.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] }),
      
      // Delete activity logs
      Activity.deleteMany({ $or: [{ userId: user._id }, { targetUserId: user._id }] }),
      
      // Delete call history
      CallHistory.deleteMany({ $or: [{ caller: user._id }, { receiver: user._id }] }),
      
      // Delete friend requests
      FriendRequest.deleteMany({ $or: [{ from: user._id }, { to: user._id }] })
    ]);
    
    res.json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted'
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    });
  }
});

// @route   POST /api/account/export-data
// @desc    Export all user data (GDPR compliance)
// @access  Private
router.post('/export-data', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const matches = await Match.find({ users: req.user._id }).populate('users', 'name email');
    const messages = await Message.find({ 
      $or: [{ sender: req.user._id }, { receiver: req.user._id }] 
    });
    const activities = await Activity.find({ userId: req.user._id });
    const callHistory = await CallHistory.find({ 
      $or: [{ caller: req.user._id }, { receiver: req.user._id }] 
    });
    
    const exportData = {
      exportDate: new Date(),
      profile: {
        name: user.name,
        email: user.email,
        age: user.age,
        gender: user.gender,
        bio: user.bio,
        interests: user.interests,
        location: user.location,
        verified: user.verified,
        createdAt: user.createdAt
      },
      matches: matches.map(m => ({
        matchedWith: m.users.filter(u => u._id.toString() !== req.user._id.toString())[0]?.name,
        matchedAt: m.createdAt
      })),
      messageCount: messages.length,
      activityCount: activities.length,
      callHistoryCount: callHistory.length
    };
    
    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    });
  }
});

// @route   GET /api/account/privacy-settings
// @desc    Get privacy settings
// @access  Private
router.get('/privacy-settings', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({
      success: true,
      data: user.privacySettings || {
        hideAge: false,
        showOnlineStatus: true,
        showDistance: true,
        showLastActive: true,
        whoCanViewStories: 'friends',
        allowMessageCopying: true
      }
    });
  } catch (error) {
    console.error('Get privacy settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get privacy settings'
    });
  }
});

// @route   PUT /api/account/privacy-settings
// @desc    Update privacy settings
// @access  Private
router.put('/privacy-settings', protect, async (req, res) => {
  try {
    const { showOnlineStatus, showDistance, showLastActive, hideAge, whoCanViewStories, allowMessageCopying } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user.privacySettings) {
      user.privacySettings = {};
    }
    
    if (showOnlineStatus !== undefined) {
      user.privacySettings.showOnlineStatus = showOnlineStatus;
    }
    if (showDistance !== undefined) {
      user.privacySettings.showDistance = showDistance;
    }
    if (showLastActive !== undefined) {
      user.privacySettings.showLastActive = showLastActive;
    }
    if (hideAge !== undefined) {
      user.privacySettings.hideAge = hideAge;
    }
    if (whoCanViewStories !== undefined) {
      user.privacySettings.whoCanViewStories = whoCanViewStories;
    }
    if (allowMessageCopying !== undefined) {
      user.privacySettings.allowMessageCopying = allowMessageCopying;
    }
    
    await user.save();
    
    res.json({
      success: true,
      privacySettings: user.privacySettings
    });
  } catch (error) {
    console.error('Privacy settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings'
    });
  }
});

// @route   PUT /api/account/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }
    
    const user = await User.findById(req.user._id).select('+password');
    
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change password for accounts created with social login'
      });
    }
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// @route   PUT /api/account/settings
// @desc    Update account settings (notifications, theme)
// @access  Private
router.put('/settings', protect, async (req, res) => {
  try {
    const { emailNotifications, pushNotifications, theme } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user.settings) {
      user.settings = {};
    }
    
    if (emailNotifications !== undefined) {
      user.settings.emailNotifications = emailNotifications;
    }
    if (pushNotifications !== undefined) {
      user.settings.pushNotifications = pushNotifications;
      user.pushNotificationsEnabled = pushNotifications;
    }
    if (theme !== undefined && ['light', 'dark', 'system'].includes(theme)) {
      user.settings.theme = theme;
    }
    
    await user.save();
    
    res.json({
      success: true,
      settings: user.settings
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
});

// @route   GET /api/account/settings
// @desc    Get account settings
// @access  Private
router.get('/settings', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      settings: user.settings || { emailNotifications: true, pushNotifications: true, theme: 'system' },
      privacySettings: user.privacySettings || {}
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get settings'
    });
  }
});

// @route   POST /api/account/request-deletion-otp
// @desc    Request OTP for account deletion (for OAuth users without password)
// @access  Private
router.post('/request-deletion-otp', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    
    user.deletionOTP = otp;
    user.deletionOTPExpire = otpExpiry;
    await user.save();
    
    await sendOTP(user.email, otp);
    
    res.json({
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (error) {
    console.error('Request deletion OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code'
    });
  }
});

// @route   DELETE /api/account/delete-with-otp
// @desc    Delete account using OTP verification
// @access  Private
router.delete('/delete-with-otp', protect, async (req, res) => {
  try {
    const { otp, reason } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user.deletionOTP || !user.deletionOTPExpire) {
      return res.status(400).json({
        success: false,
        message: 'Please request a verification code first'
      });
    }
    
    if (user.deletionOTP !== otp) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code'
      });
    }
    
    if (new Date() > user.deletionOTPExpire) {
      return res.status(401).json({
        success: false,
        message: 'Verification code has expired'
      });
    }
    
    console.log('Account deletion with OTP - User ID:', user._id, 'Reason:', reason);
    
    await Promise.all([
      User.deleteOne({ _id: user._id }),
      Match.deleteMany({ users: user._id }),
      Message.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] }),
      Activity.deleteMany({ $or: [{ userId: user._id }, { targetUserId: user._id }] }),
      CallHistory.deleteMany({ $or: [{ caller: user._id }, { receiver: user._id }] }),
      FriendRequest.deleteMany({ $or: [{ from: user._id }, { to: user._id }] })
    ]);
    
    res.json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted'
    });
  } catch (error) {
    console.error('Account deletion with OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    });
  }
});

// @route   GET /api/account/check-auth-method
// @desc    Check if user has password (for determining deletion method)
// @access  Private
router.get('/check-auth-method', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('password googleId');
    
    res.json({
      success: true,
      hasPassword: !!user.password,
      isOAuthUser: !!user.googleId
    });
  } catch (error) {
    console.error('Check auth method error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check authentication method'
    });
  }
});

module.exports = router;
