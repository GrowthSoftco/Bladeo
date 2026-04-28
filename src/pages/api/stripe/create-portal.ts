import type { APIRoute } from 'astro';
import { stripe } from '@/lib/stripe';
import { createServerClient, createAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createServerClient(cookies);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 });
    }

    const admin = createAdminClient();
    const { data: member } = await admin
      .from('members')
      .select('barbershop_id')
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: 'Miembro no encontrado.' }), { status: 404 });
    }

    const { data: subscription } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('barbershop_id', member.barbershop_id)
      .single();

    if (!subscription?.stripe_customer_id || subscription.stripe_customer_id === 'pending') {
      return new Response(JSON.stringify({ error: 'No se encontró el cliente de pago.' }), { status: 404 });
    }

    const origin = request.headers.get('origin') ?? 'http://localhost:4321';
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/app/settings`,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (err) {
    console.error('Portal error:', err);
    return new Response(JSON.stringify({ error: 'Error al abrir el portal de facturación.' }), { status: 500 });
  }
};
