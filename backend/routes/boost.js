const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Boost = require('../models/Boost');
const User = require('../models/User');

// Boost duration configurations (in minutes)
const BOOST_CONFIGS = {
  standard: { duration: 30, multiplier: 2, name: 'Standard Boost' },
  super: { duration: 60, multiplier: 3, name: 'Super Boost' },
  premium: { duration: 180, multiplier: 5, name: 'Premium Boost' }
};

// Get current boost status
router.get('/status', protect, async (req, res) => {
  try {
    const activeBoost = await Boost.getActiveBoost(req.user._id);
    
    if (!activeBoost) {
      return res.json({
        success: true,
        hasActiveBoost: false,
        boost: null
      });
    }

    const now = new Date();
    const remainingMs = activeBoost.expiresAt - now;
    const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));

    res.json({
      success: true,
      hasActiveBoost: true,
      boost: {
        id: activeBoost._id,
        type: activeBoost.type,
        multiplier: activeBoost.multiplier,
        startedAt: activeBoost.startedAt,
        expiresAt: activeBoost.expiresAt,
        remainingMinutes,
        viewsGained: activeBoost.viewsGained,
        likesGained: activeBoost.likesGained,
        matchesGained: activeBoost.matchesGained
      }
    });
  } catch (error) {
    console.error('Get boost status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get boost status' });
  }
});

// Activate a boost
router.post('/activate', protect, async (req, res) => {
  try {
    const { type = 'standard', source = 'purchase' } = req.body;

    // Validate boost type
    if (!BOOST_CONFIGS[type]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid boost type'
      });
    }

    // Check for existing active boost
    const existingBoost = await Boost.getActiveBoost(req.user._id);
    if (existingBoost) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active boost',
        existingBoost: {
          type: existingBoost.type,
          expiresAt: existingBoost.expiresAt
        }
      });
    }

    const config = BOOST_CONFIGS[type];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.duration * 60000);

    const boost = await Boost.create({
      userId: req.user._id,
      type,
      multiplier: config.multiplier,
      startedAt: now,
      expiresAt,
      source
    });

    res.json({
      success: true,
      message: `${config.name} activated!`,
      boost: {
        id: boost._id,
        type: boost.type,
        multiplier: boost.multiplier,
        durationMinutes: config.duration,
        startedAt: boost.startedAt,
        expiresAt: boost.expiresAt
      }
    });
  } catch (error) {
    console.error('Activate boost error:', error);
    res.status(500).json({ success: false, message: 'Failed to activate boost' });
  }
});

// Extend current boost
router.post('/extend', protect, async (req, res) => {
  try {
    const { additionalMinutes = 30 } = req.body;

    const activeBoost = await Boost.getActiveBoost(req.user._id);
    if (!activeBoost) {
      return res.status(400).json({
        success: false,
        message: 'No active boost to extend'
      });
    }

    // Max extension of 3 hours
    const maxExtension = 180;
    const extension = Math.min(additionalMinutes, maxExtension);
    
    activeBoost.expiresAt = new Date(activeBoost.expiresAt.getTime() + extension * 60000);
    await activeBoost.save();

    res.json({
      success: true,
      message: `Boost extended by ${extension} minutes`,
      newExpiresAt: activeBoost.expiresAt
    });
  } catch (error) {
    console.error('Extend boost error:', error);
    res.status(500).json({ success: false, message: 'Failed to extend boost' });
  }
});

// Cancel/deactivate current boost
router.delete('/cancel', protect, async (req, res) => {
  try {
    const activeBoost = await Boost.getActiveBoost(req.user._id);
    if (!activeBoost) {
      return res.status(400).json({
        success: false,
        message: 'No active boost to cancel'
      });
    }

    activeBoost.isActive = false;
    await activeBoost.save();

    res.json({
      success: true,
      message: 'Boost cancelled',
      stats: {
        viewsGained: activeBoost.viewsGained,
        likesGained: activeBoost.likesGained,
        matchesGained: activeBoost.matchesGained
      }
    });
  } catch (error) {
    console.error('Cancel boost error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel boost' });
  }
});

// Get boost history
router.get('/history', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const boosts = await Boost.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const stats = await Boost.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          totalBoosts: { $sum: 1 },
          totalViews: { $sum: '$viewsGained' },
          totalLikes: { $sum: '$likesGained' },
          totalMatches: { $sum: '$matchesGained' }
        }
      }
    ]);

    res.json({
      success: true,
      boosts: boosts.map(b => ({
        id: b._id,
        type: b.type,
        startedAt: b.startedAt,
        expiresAt: b.expiresAt,
        wasActive: b.isActive && b.expiresAt > new Date(),
        viewsGained: b.viewsGained,
        likesGained: b.likesGained,
        matchesGained: b.matchesGained,
        source: b.source
      })),
      totalStats: stats[0] || {
        totalBoosts: 0,
        totalViews: 0,
        totalLikes: 0,
        totalMatches: 0
      }
    });
  } catch (error) {
    console.error('Get boost history error:', error);
    res.status(500).json({ success: false, message: 'Failed to get boost history' });
  }
});

// Get available boost packages (for UI)
router.get('/packages', protect, async (req, res) => {
  try {
    const packages = Object.entries(BOOST_CONFIGS).map(([key, config]) => ({
      id: key,
      name: config.name,
      durationMinutes: config.duration,
      multiplier: config.multiplier,
      description: `Boost your profile ${config.multiplier}x for ${config.duration} minutes`
    }));

    res.json({
      success: true,
      packages
    });
  } catch (error) {
    console.error('Get boost packages error:', error);
    res.status(500).json({ success: false, message: 'Failed to get packages' });
  }
});

// Internal: Record boost stat (server-side only, validates caller)
// This should only be called by internal routes when a view/like/match occurs
const recordBoostStat = async (userId, stat) => {
  try {
    const activeBoost = await Boost.getActiveBoost(userId);
    if (activeBoost) {
      await activeBoost.incrementStat(stat);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Record boost stat error:', error);
    return false;
  }
};

// Export for use in other routes
router.recordBoostStat = recordBoostStat;

module.exports = router;
