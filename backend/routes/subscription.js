const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
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

// ─── Apple iOS Receipt Validation ───────────────────────────────────────────
async function validateAppleReceipt(receiptData) {
  const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET;
  if (!sharedSecret) {
    console.warn('[Apple IAP] APPLE_IAP_SHARED_SECRET not set — skipping server-side validation');
    return { valid: true, skipped: true };
  }

  const payload = {
    'receipt-data': receiptData,
    'password': sharedSecret,
    'exclude-old-transactions': true
  };

  // Try production first; Apple returns status 21007 for sandbox receipts
  try {
    const prodRes = await axios.post('https://buy.itunes.apple.com/verifyReceipt', payload, { timeout: 10000 });
    if (prodRes.data.status === 21007) {
      // Sandbox receipt — retry against sandbox endpoint
      const sandboxRes = await axios.post('https://sandbox.itunes.apple.com/verifyReceipt', payload, { timeout: 10000 });
      if (sandboxRes.data.status !== 0) {
        return { valid: false, error: `Apple sandbox status ${sandboxRes.data.status}` };
      }
      return { valid: true, data: sandboxRes.data };
    }
    if (prodRes.data.status !== 0) {
      return { valid: false, error: `Apple status ${prodRes.data.status}` };
    }
    return { valid: true, data: prodRes.data };
  } catch (err) {
    console.error('[Apple IAP] Validation request failed:', err.message);
    return { valid: false, error: err.message };
  }
}

// ─── Google Android Purchase Validation ─────────────────────────────────────
async function validateGoogleReceipt(purchaseToken, productId) {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.afroconnect.app';

  if (!serviceAccountJson) {
    console.warn('[Google IAP] GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping server-side validation');
    return { valid: true, skipped: true };
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    console.error('[Google IAP] Could not parse GOOGLE_SERVICE_ACCOUNT_JSON');
    return { valid: false, error: 'Invalid service account JSON' };
  }

  try {
    // Build a JWT to obtain an OAuth2 access token from Google
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    };
    const signedJwt = jwt.sign(jwtPayload, serviceAccount.private_key, { algorithm: 'RS256' });

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt
    }, { timeout: 10000 });

    const accessToken = tokenRes.data.access_token;

    // Verify the subscription purchase against the Play Developer API
    const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    const verifyRes = await axios.get(verifyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000
    });

    const purchase = verifyRes.data;
    // paymentState: 1 = payment received, 2 = free trial, 0 = pending
    if (purchase.paymentState !== 1 && purchase.paymentState !== 2) {
      return { valid: false, error: `Google paymentState=${purchase.paymentState}` };
    }
    return { valid: true, data: purchase };
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    console.error('[Google IAP] Validation request failed:', errMsg);
    return { valid: false, error: errMsg };
  }
}

// ────────────────────────────────────────────────────────────────────────────

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
    res.json({ success: true, plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('premium dailySwipes dailySuperLikes');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let isActive = user.premium?.isActive || false;
    if (isActive && user.premium?.expiresAt && new Date(user.premium.expiresAt) < new Date()) {
      isActive = false;
      await User.findByIdAndUpdate(user._id, { 'premium.isActive': false });
    }

    // Reset super like count if it's a new day
    let superLikesRemaining = isActive ? 10 : 0;
    if (isActive && user.dailySuperLikes) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const lastReset = new Date(user.dailySuperLikes.lastReset || 0); lastReset.setHours(0, 0, 0, 0);
      const usedToday = lastReset < today ? 0 : (user.dailySuperLikes.count || 0);
      superLikesRemaining = Math.max(0, 10 - usedToday);
    }

    res.json({
      success: true,
      subscription: {
        isActive,
        expiresAt: user.premium?.expiresAt,
        plan: user.premium?.plan,
        features: isActive ? PREMIUM_INFO.features : []
      },
      usage: {
        swipesRemaining: isActive ? 999 : Math.max(0, 10 - (user.dailySwipes?.count || 0)),
        superLikesRemaining
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

    const validProductIds = [
      'afroconnect_premium_daily',
      'afroconnect_premium_weekly',
      'afroconnect_premium_monthly',
      'afroconnect_premium_yearly'
    ];
    if (!validProductIds.includes(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    }

    // ── Server-side receipt validation ──────────────────────────────────────
    let validationResult;
    if (platform === 'ios') {
      validationResult = await validateAppleReceipt(receipt);
    } else {
      validationResult = await validateGoogleReceipt(receipt, productId);
    }

    if (!validationResult.valid) {
      console.warn(`[IAP] Receipt rejected for user ${user._id} (${platform}): ${validationResult.error}`);
      return res.status(402).json({ success: false, message: 'Purchase could not be verified. Please try again.' });
    }

    if (validationResult.skipped) {
      console.warn(`[IAP] Server-side validation skipped for ${platform} — credentials not configured. Trusting client.`);
    } else {
      console.log(`[IAP] Server-side receipt verified for user ${user._id} via ${platform}`);
    }
    // ─────────────────────────────────────────────────────────────────────────

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
        superLikesPerDay: 10,
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
        plan: interval,
        source: platform,
        features: PREMIUM_INFO.features
      }
    });
  } catch (error) {
    console.error('Receipt validation error:', error);
    res.status(500).json({ success: false, message: 'Failed to validate receipt' });
  }
});

module.exports = router;
