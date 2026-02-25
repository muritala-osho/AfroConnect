const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { getUncachableStripeClient, getStripePublishableKey } = require('../stripe/stripeClient');

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

    let activePriceId = priceId;
    
    const intervalMap = {
      'price_daily': 'day',
      'price_weekly': 'week', 
      'price_monthly': 'month',
      'price_yearly': 'year'
    };
    
    const targetInterval = intervalMap[priceId];
    
    try {
      if (targetInterval) {
        const prices = await stripe.prices.list({ active: true, limit: 20, expand: ['data.product'], recurring: { interval: targetInterval } });
        if (prices.data.length > 0) {
          activePriceId = prices.data[0].id;
          console.log(`Mapped ${priceId} to Stripe price: ${activePriceId}`);
        } else {
          const allPrices = await stripe.prices.list({ active: true, limit: 10 });
          if (allPrices.data.length > 0) {
            activePriceId = allPrices.data[0].id;
            console.log(`No ${targetInterval} price found, using fallback: ${activePriceId}`);
          } else {
            throw new Error('No active prices found in Stripe. Please create a product with prices in your Stripe dashboard.');
          }
        }
      } else {
        await stripe.prices.retrieve(priceId);
      }
    } catch (e) {
      if (e.message?.includes('No active prices')) throw e;
      console.log(`Price ID ${priceId} not found, searching for fallback...`);
      const prices = await stripe.prices.list({ active: true, limit: 10, expand: ['data.product'] });
      const fallback = prices.data.find(p => p.nickname === 'Premium' || p.lookup_key === 'premium') || prices.data[0];
      if (fallback) {
        console.log(`Using fallback price ID: ${fallback.id}`);
        activePriceId = fallback.id;
      } else {
        throw new Error('No active prices found in Stripe dashboard.');
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
