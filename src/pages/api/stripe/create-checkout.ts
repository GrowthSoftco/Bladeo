import type { APIRoute } from 'astro';
import { stripe } from '@/lib/stripe';
import { STRIPE_PRICES } from '@/lib/stripe-config';
import { createServerClient, createAdminClient } from '@/lib/supabase';
import type { TierKey } from '@/lib/stripe-config';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { tier, billingCycle } = await request.json() as { tier: TierKey; billingCycle: 'monthly' | 'annual' };

    if (!tier || !billingCycle) {
      return new Response(JSON.stringify({ error: 'Parámetros inválidos.' }), { status: 400 });
    }

    const supabase = createServerClient(cookies);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 });
    }

    const admin = createAdminClient();

    // Get member + barbershop
    const { data: member } = await admin
      .from('members')
      .select('barbershop_id')
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Miembro no encontrado.' }), { status: 404 });
    }

    // Get subscription
    const { data: subscription } = await admin
      .from('subscriptions')
      .select('*')
      .eq('barbershop_id', member.barbershop_id)
      .single();

    // Get or create Stripe customer
    let stripeCustomerId = subscription?.stripe_customer_id;

    if (!stripeCustomerId || stripeCustomerId === 'pending') {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { barbershop_id: member.barbershop_id, user_id: user.id },
      });
      stripeCustomerId = customer.id;

      await admin
        .from('subscriptions')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('barbershop_id', member.barbershop_id);
    }

    const priceId = STRIPE_PRICES[tier][billingCycle];
    const origin = request.headers.get('origin') ?? 'http://localhost:4321';

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      currency: 'cop',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/plans`,
      metadata: { barbershop_id: member.barbershop_id, tier, billing_cycle: billingCycle },
      subscription_data: {
        metadata: { barbershop_id: member.barbershop_id, tier },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (err) {
    console.error('Checkout error:', err);
    return new Response(JSON.stringify({ error: 'Error al crear la sesión de pago.' }), { status: 500 });
  }
};
