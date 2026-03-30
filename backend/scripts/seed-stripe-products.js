const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getUncachableStripeClient } = require('../stripe/stripeClient');

const PRODUCTS = [
  {
    name: 'AfroConnect Plus',
    description: 'Unlock unlimited swipes, rewinds, and more!',
    metadata: {
      plan_key: 'plus',
      features: 'unlimited_swipes,unlimited_rewinds,5_superlikes,1_boost,no_ads'
    },
    prices: [
      { amount: 999, interval: 'month', nickname: 'Monthly' },
      { amount: 5999, interval: 'year', nickname: 'Yearly (Save 50%)' }
    ]
  },
  {
    name: 'AfroConnect Gold',
    description: 'See who likes you, advanced filters, and read receipts!',
    metadata: {
      plan_key: 'gold',
      features: 'plus_features,see_who_likes,10_superlikes,5_boosts,advanced_filters,read_receipts'
    },
    prices: [
      { amount: 1999, interval: 'month', nickname: 'Monthly' },
      { amount: 11999, interval: 'year', nickname: 'Yearly (Save 50%)' }
    ]
  },
  {
    name: 'AfroConnect Platinum',
    description: 'The ultimate dating experience with all features unlocked!',
    metadata: {
      plan_key: 'platinum',
      features: 'gold_features,unlimited_superlikes,10_boosts,priority_matching,incognito_mode'
    },
    prices: [
      { amount: 2999, interval: 'month', nickname: 'Monthly' },
      { amount: 17999, interval: 'year', nickname: 'Yearly (Save 50%)' }
    ]
  }
];

async function seedProducts() {
  console.log('Starting Stripe product seeding...');
  
  const stripe = await getUncachableStripeClient();
  
  for (const productData of PRODUCTS) {
    try {
      const existingProducts = await stripe.products.search({
        query: `name:'${productData.name}'`
      });

      if (existingProducts.data.length > 0) {
        console.log(`Product "${productData.name}" already exists, skipping...`);
        continue;
      }

      const product = await stripe.products.create({
        name: productData.name,
        description: productData.description,
        metadata: productData.metadata
      });

      console.log(`Created product: ${product.name} (${product.id})`);

      for (const priceData of productData.prices) {
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: priceData.amount,
          currency: 'usd',
          recurring: { interval: priceData.interval },
          nickname: priceData.nickname,
          metadata: {
            plan_key: productData.metadata.plan_key,
            interval: priceData.interval
          }
        });

        console.log(`  Created price: ${priceData.nickname} - $${(priceData.amount / 100).toFixed(2)}/${priceData.interval} (${price.id})`);
      }
    } catch (error) {
      console.error(`Error creating product "${productData.name}":`, error.message);
    }
  }

  console.log('\nProduct seeding complete!');
  process.exit(0);
}

seedProducts().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
