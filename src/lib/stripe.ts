import Stripe from 'stripe';

const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY as string;

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-03-31.basil',
});
