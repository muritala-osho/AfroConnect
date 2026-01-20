const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { getUncachableStripeClient, getStripePublishableKey } = require('../stripe/stripeClient');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5
});

// Simplified PLANS for a single Premium plan with different durations
const PREMIUM_INFO = {
  name: 'AfroConnect Premium',
  description: 'The ultimate dating experience with all features unlocked',
  features: [
    'Unlimited swipes',
    'See who likes you',
    'Unlimited rewinds',
    '10 Super Likes per day',
    '10 Boosts per month',
    'Advanced filters',
    'Read receipts',
    'Priority matching',
    'Incognito mode',
    'Status blocking',
    'Nonstop calls'
  ]
};

// Default prices for the single plan with different intervals
// IMPORTANT: These IDs MUST match existing prices in your Stripe dashboard
// If you see "No such price" errors, update these with your actual price IDs
const DEFAULT_PRICES = [
  { id: 'price_1SpImVIWqwrt8zrdSAKeqXhw', amount: 999, currency: 'usd', interval: 'month', name: 'Premium Monthly' }
];

router.get('/plans', async (req, res) => {
  try {
    // Return a structured plans array for frontend compatibility
    const plans = [
      {
        id: 'premium_plan',
        name: PREMIUM_INFO.name,
        description: PREMIUM_INFO.description,
        planKey: 'platinum', // Mapping to premium color in frontend
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

router.post('/create-checkout', protect, async (req, res) => {
  try {
    const { priceId } = req.body;
    const stripe = await getUncachableStripeClient();
    const user = await User.findById(req.user._id);

    // Dynamic price handling: If the price ID doesn't exist, we'll try to find an active price with the same amount/interval
    let activePriceId = priceId;
    
    try {
      await stripe.prices.retrieve(priceId);
    } catch (e) {
      console.log(`Price ID ${priceId} not found, searching for equivalent active price...`);
      const prices = await stripe.prices.list({ active: true, limit: 10, expand: ['data.product'] });
      // Find a price that matches the name if possible, or just pick the first one as a last resort fallback
      const fallback = prices.data.find(p => p.nickname === 'Premium' || p.lookup_key === 'premium') || prices.data[0];
      if (fallback) {
        console.log(`Using fallback price ID: ${fallback.id}`);
        activePriceId = fallback.id;
      } else {
        throw new Error('No active prices found in Stripe dashboard. Please create a product and price in your Stripe test mode.');
      }
    }

    const sessionOptions = {
      payment_method_types: ['card'],
      line_items: [{ price: activePriceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `https://${process.env.REPLIT_DEV_DOMAIN}/payment-success`,
      cancel_url: `https://${process.env.REPLIT_DEV_DOMAIN}/payment-cancel`,
      metadata: { userId: user._id.toString() }
    };

    if (user.premium?.stripeCustomerId) {
      sessionOptions.customer = user.premium.stripeCustomerId;
    } else {
      sessionOptions.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('Stripe Session Creation Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Checkout error' });
  }
});

module.exports = router;
