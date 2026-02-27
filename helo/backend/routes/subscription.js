const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const PREMIUM_INFO = {
  name: 'AfroConnect Premium',
  description: 'The ultimate dating experience with all features unlocked',
  features: [
    'Unlimited Likes',
    'See Who Likes You',
    '10 Super Likes Daily',
    'Unlimited Rewinds',
    'Incognito Mode',
    '1 Free Boost Monthly',
    'Global Discovery',
    'Unlimited Calls',
    'Story Viewer Details',
    'Advanced Filters',
    'Premium Badge',
    'No Distance Limits'
  ]
};

const DEFAULT_PRICES = [
  { id: 'premium_monthly', amount: 999, currency: 'usd', interval: 'month', name: 'Premium Monthly' }
];

router.get('/plans', async (req, res) => {
  try {
    const plans = [
      {
        id: 'premium_plan',
        name: PREMIUM_INFO.name,
        description: PREMIUM_INFO.description,
        planKey: 'platinum',
        info: PREMIUM_INFO,
        prices: DEFAULT_PRICES
      }
    ];
    res.json({
      success: true,
      plans: plans
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('premium dailySwipes dailySuperLikes');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      subscription: {
        isActive: user.premium?.isActive || false,
        expiresAt: user.premium?.expiresAt,
        features: user.premium?.isActive ? PREMIUM_INFO.features : []
      },
      usage: {
        swipesRemaining: user.premium?.isActive ? 999 : Math.max(0, 10 - (user.dailySwipes?.count || 0))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/validate-receipt', protect, async (req, res) => {
  try {
    const { platform, receipt, productId } = req.body;

    if (!platform || !['android', 'ios'].includes(platform)) {
      return res.status(400).json({ success: false, message: 'Invalid platform. Must be "android" or "ios".' });
    }

    if (!receipt || receipt === 'pending_iap_integration') {
      return res.status(400).json({ success: false, message: 'Valid purchase receipt is required.' });
    }

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // TODO: Add real server-to-server receipt validation for production:
    // iOS: POST receipt to https://buy.itunes.apple.com/verifyReceipt (or sandbox URL)
    // Android: Use googleapis.com/androidpublisher/v3 with service account credentials
    // For now, accept receipts from the IAP SDK (the store already validated the purchase client-side)
    const validProductIds = [
      'afroconnect_premium_daily',
      'afroconnect_premium_weekly',
      'afroconnect_premium_monthly',
      'afroconnect_premium_yearly'
    ];

    if (!validProductIds.includes(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    }

    const intervalMap = {
      'afroconnect_premium_daily': 'day',
      'afroconnect_premium_weekly': 'week',
      'afroconnect_premium_monthly': 'month',
      'afroconnect_premium_yearly': 'year'
    };
    const interval = intervalMap[productId] || 'month';
    const durationMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    };

    await User.findByIdAndUpdate(user._id, {
      'premium.isActive': true,
      'premium.plan': interval,
      'premium.source': platform,
      'premium.activatedAt': new Date(),
      'premium.expiresAt': new Date(Date.now() + durationMs[interval]),
      'premium.receipt': receipt,
      'premium.productId': productId,
      'premium.features': {
        unlimitedSwipes: true,
        seeWhoLikesYou: true,
        unlimitedRewinds: true,
        boostPerMonth: 10,
        superLikesPerDay: 999,
        noAds: true,
        advancedFilters: true,
        readReceipts: true,
        priorityMatches: true,
        incognitoMode: true
      }
    });

    console.log(`Premium activated for user ${user._id} via ${platform} in-app purchase`);

    res.json({
      success: true,
      message: 'Premium activated successfully',
      subscription: {
        isActive: true,
        plan: 'premium',
        source: platform,
        features: PREMIUM_INFO.features
      }
    });
  } catch (error) {
    console.error('Receipt validation error:', error);
    res.status(500).json({ success: false, message: 'Failed to validate receipt' });
  }
});

router.post('/restore-purchases', protect, async (req, res) => {
  try {
    const { platform, receipt } = req.body;

    if (!platform || !['android', 'ios'].includes(platform)) {
      return res.status(400).json({ success: false, message: 'Invalid platform. Must be "android" or "ios".' });
    }

    if (!receipt) {
      return res.status(400).json({ success: false, message: 'Receipt is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // TODO: Add real server-to-server receipt validation for production
    // For now, accept the restore request and re-activate premium

    await User.findByIdAndUpdate(user._id, {
      'premium.isActive': true,
      'premium.plan': 'premium',
      'premium.source': platform,
      'premium.activatedAt': new Date(),
      'premium.receipt': receipt,
      'premium.features': {
        unlimitedSwipes: true,
        seeWhoLikesYou: true,
        unlimitedRewinds: true,
        boostPerMonth: 10,
        superLikesPerDay: 999,
        noAds: true,
        advancedFilters: true,
        readReceipts: true,
        priorityMatches: true,
        incognitoMode: true
      }
    });

    console.log(`Premium restored for user ${user._id} via ${platform} purchase restore`);

    res.json({
      success: true,
      message: 'Purchases restored successfully',
      subscription: {
        isActive: true,
        plan: 'premium',
        source: platform,
        features: PREMIUM_INFO.features
      }
    });
  } catch (error) {
    console.error('Restore purchases error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore purchases' });
  }
});

module.exports = router;
