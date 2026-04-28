import type { APIRoute } from 'astro';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase';
import type Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET as string;

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret.', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature.', { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const { barbershop_id, tier, billing_cycle } = session.metadata ?? {};
        if (!barbershop_id) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        await admin.from('subscriptions').update({
          stripe_subscription_id: subscription.id,
          tier: tier ?? 'basic',
          billing_cycle: billing_cycle ?? 'monthly',
          status: 'active',
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('barbershop_id', barbershop_id);

        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const barbershop_id = sub.metadata?.barbershop_id;
        if (!barbershop_id) break;

        const tier = sub.metadata?.tier ?? 'basic';
        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'cancelled',
          unpaid: 'unpaid',
          incomplete: 'incomplete',
          incomplete_expired: 'cancelled',
          trialing: 'active',
          paused: 'past_due',
        };

        await admin.from('subscriptions').update({
          status: statusMap[sub.status] ?? 'past_due',
          tier,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id);

        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await admin.from('subscriptions').update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await admin.from('subscriptions').update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          }).eq('stripe_subscription_id', invoice.subscription as string);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await admin.from('subscriptions').update({
            status: 'active',
            updated_at: new Date().toISOString(),
          }).eq('stripe_subscription_id', invoice.subscription as string);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Error processing webhook ${event.type}:`, err);
    return new Response('Webhook processing error.', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
