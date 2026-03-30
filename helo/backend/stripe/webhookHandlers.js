const { getStripeSync } = require('./stripeClient');
const User = require('../models/User');

const PLAN_FEATURES = {
  plus: {
    unlimitedSwipes: true,
    seeWhoLikesYou: false,
    unlimitedRewinds: true,
    boostPerMonth: 1,
    superLikesPerDay: 5,
    noAds: true,
    advancedFilters: false,
    readReceipts: false,
    priorityMatches: false,
    incognitoMode: false
  },
  gold: {
    unlimitedSwipes: true,
    seeWhoLikesYou: true,
    unlimitedRewinds: true,
    boostPerMonth: 5,
    superLikesPerDay: 10,
    noAds: true,
    advancedFilters: true,
    readReceipts: true,
    priorityMatches: false,
    incognitoMode: false
  },
  platinum: {
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
};

async function handleCheckoutCompleted(session) {
  try {
    const userId = session.metadata?.userId;
    const customerId = session.customer;
    
    if (userId && customerId) {
      await User.findByIdAndUpdate(userId, {
        'premium.stripeCustomerId': customerId
      });
      console.log(`Linked Stripe customer ${customerId} to user ${userId}`);
    }
  } catch (error) {
    console.error('Error handling checkout completed:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    const customerId = subscription.customer;
    let user = await User.findOne({ 'premium.stripeCustomerId': customerId });
    
    if (!user && subscription.metadata?.userId) {
      user = await User.findById(subscription.metadata.userId);
      if (user) {
        await User.findByIdAndUpdate(user._id, {
          'premium.stripeCustomerId': customerId
        });
        console.log(`Linked Stripe customer ${customerId} to user ${user._id} via metadata`);
      }
    }
    
    if (!user) {
      console.log('No user found for customer:', customerId);
      return;
    }

    const status = subscription.status;
    const isActive = ['active', 'trialing'].includes(status);
    
    let planName = 'free';
    
    const priceData = subscription.items?.data?.[0]?.price;
    if (priceData) {
      if (priceData.metadata?.plan_key) {
        planName = priceData.metadata.plan_key;
      } else {
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
        try {
          const productId = priceData.product;
          const result = await pool.query(
            'SELECT metadata FROM stripe.products WHERE id = $1',
            [productId]
          );
          if (result.rows[0]?.metadata?.plan_key) {
            planName = result.rows[0].metadata.plan_key;
          }
        } catch (dbError) {
          console.error('Error fetching product metadata:', dbError.message);
        } finally {
          await pool.end();
        }
      }
    }
    
    console.log(`Subscription update: customer=${customerId}, plan=${planName}, status=${status}`);

    const features = isActive && planName !== 'free' ? PLAN_FEATURES[planName] : {
      unlimitedSwipes: false,
      seeWhoLikesYou: false,
      unlimitedRewinds: false,
      boostPerMonth: 0,
      superLikesPerDay: 1,
      noAds: false,
      advancedFilters: false,
      readReceipts: false,
      priorityMatches: false,
      incognitoMode: false
    };

    await User.findByIdAndUpdate(user._id, {
      'premium.isActive': isActive,
      'premium.plan': isActive ? planName : 'free',
      'premium.stripeSubscriptionId': subscription.id,
      'premium.expiresAt': subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
      'premium.features': features
    });

    console.log(`Updated subscription for user ${user._id}: ${planName} (${status})`);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    const customerId = subscription.customer;
    const user = await User.findOne({ 'premium.stripeCustomerId': customerId });
    
    if (!user) return;

    await User.findByIdAndUpdate(user._id, {
      'premium.isActive': false,
      'premium.plan': 'free',
      'premium.stripeSubscriptionId': null,
      'premium.expiresAt': null,
      'premium.features': {
        unlimitedSwipes: false,
        seeWhoLikesYou: false,
        unlimitedRewinds: false,
        boostPerMonth: 0,
        superLikesPerDay: 1,
        noAds: false,
        advancedFilters: false,
        readReceipts: false,
        priorityMatches: false,
        incognitoMode: false
      }
    });

    console.log(`Subscription deleted for user ${user._id}`);
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

class WebhookHandlers {
  static async processWebhook(payload, signature, uuid) {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    const event = await sync.processWebhook(payload, signature, uuid);

    if (event) {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
      }
    }

    return event;
  }
}

module.exports = { WebhookHandlers, PLAN_FEATURES, handleCheckoutCompleted };
