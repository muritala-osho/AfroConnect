const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

router.put('/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['online', 'offline', 'away'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updateData = {
      onlineStatus: status,
      lastActive: new Date()
    };

    await User.findByIdAndUpdate(req.user.id, updateData);

    res.json({
      success: true,
      data: { status, lastActive: updateData.lastActive }
    });
  } catch (error) {
    console.error('Update activity status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/status/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('onlineStatus lastActive privacySettings');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const privacy = user.privacySettings || {};
    
    res.json({
      success: true,
      data: {
        onlineStatus: privacy.showOnlineStatus === false ? null : user.onlineStatus,
        lastActive: privacy.showLastActive === false ? null : user.lastActive
      }
    });
  } catch (error) {
    console.error('Get activity status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/heartbeat', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      onlineStatus: 'online',
      lastActive: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
