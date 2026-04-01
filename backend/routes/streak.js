const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

router.post('/check-in', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const lastLogin = user.streak?.lastLoginDate
      ? new Date(user.streak.lastLoginDate)
      : null;

    let current = user.streak?.current || 0;
    let longest = user.streak?.longest || 0;
    let alreadyCheckedIn = false;

    if (lastLogin) {
      const lastDay = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
      const diffDays = Math.round((today - lastDay) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        alreadyCheckedIn = true;
      } else if (diffDays === 1) {
        current += 1;
      } else {
        current = 1;
      }
    } else {
      current = 1;
    }

    if (!alreadyCheckedIn) {
      if (current > longest) longest = current;
      user.streak = {
        current,
        longest,
        lastLoginDate: now,
        freezeUsed: false
      };
      await user.save();
    }

    res.json({
      success: true,
      streak: {
        current: user.streak.current,
        longest: user.streak.longest,
        lastLoginDate: user.streak.lastLoginDate,
        alreadyCheckedIn
      }
    });
  } catch (error) {
    console.error('Streak check-in error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my-streak', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('streak');
    res.json({
      success: true,
      streak: {
        current: user.streak?.current || 0,
        longest: user.streak?.longest || 0,
        lastLoginDate: user.streak?.lastLoginDate || null
      }
    });
  } catch (error) {
    console.error('Get streak error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
