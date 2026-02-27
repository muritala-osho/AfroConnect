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

    // TODO: Implement real receipt validation
    // For iOS: verify receipt with Apple's verifyReceipt endpoint
    // For Android: verify with Google Play Developer API
    // Until real validation is implemented, reject all receipts to prevent abuse
    const isReceiptValid = false;

    if (!isReceiptValid) {
      return res.status(400).json({
        success: false,
        message: 'Receipt validation is not yet configured. In-app purchases will be available once store integration is complete.'
      });
    }

    await User.findByIdAndUpdate(user._id, {
      'premium.isActive': true,
      'premium.plan': 'premium',
      'premium.source': platform,
      'premium.activatedAt': new Date(),
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

    // TODO: Implement real receipt validation with Apple/Google
    // For iOS: verify receipt with Apple's verifyReceipt endpoint
    // For Android: verify with Google Play Developer API
    // Until real validation is implemented, reject all restore requests
    const isReceiptValid = false;

    if (!isReceiptValid) {
      return res.status(400).json({
        success: false,
        message: 'Purchase restore is not yet configured. This feature will be available once store integration is complete.'
      });
    }

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
