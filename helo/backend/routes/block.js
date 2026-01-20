
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/Match');

// @route   POST /api/block/:userId
// @desc    Block a user
// @access  Private
router.post('/:userId', protect, async (req, res) => {
  try {
    const userToBlock = req.params.userId;
    
    if (userToBlock === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    if (user.blockedUsers.includes(userToBlock)) {
      return res.status(400).json({
        success: false,
        message: 'User is already blocked'
      });
    }
    
    user.blockedUsers.push(userToBlock);
    await user.save();
    
    // Remove any existing match
    await Match.deleteMany({
      users: { $all: [req.user._id, userToBlock] }
    });
    
    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to block user'
    });
  }
});

// @route   DELETE /api/block/:userId
// @desc    Unblock a user
// @access  Private
router.delete('/:userId', protect, async (req, res) => {
  try {
    const userToUnblock = req.params.userId;
    
    const user = await User.findById(req.user._id);
    user.blockedUsers = user.blockedUsers.filter(
      id => id.toString() !== userToUnblock
    );
    await user.save();
    
    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock user'
    });
  }
});

// @route   GET /api/block/list
// @desc    Get list of blocked users
// @access  Private
router.get('/list', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('blockedUsers', 'name photos');
    
    res.json({
      success: true,
      blockedUsers: user.blockedUsers
    });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blocked users'
    });
  }
});

module.exports = router;
