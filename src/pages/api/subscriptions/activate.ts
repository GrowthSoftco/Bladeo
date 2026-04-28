import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const tier = body.tier ?? 'pro';

  const admin = createAdminClient();

  // Build payload that works with both local schema (tier) and remote schema (plan_name or tier)
  const baseData: Record<string, unknown> = {
    barbershop_id: locals.barbershop.id,
    stripe_customer_id: 'demo',
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };

  // Try the full payload first (works when schema has tier + billing_cycle)
  const fullData = { ...baseData, tier, billing_cycle: 'annual', plan_name: tier };

  const { data, error } = await admin
    .from('subscriptions')
    .upsert(fullData, { onConflict: 'barbershop_id' })
    .select()
    .single();

  if (error) {
    // Remove unknown columns one by one and retry
    const fallbacks = [
      { ...baseData, tier, plan_name: tier },       // no billing_cycle
      { ...baseData, plan_name: tier },              // no tier/billing_cycle
      { ...baseData, tier },                         // no plan_name/billing_cycle
      baseData,                                      // bare minimum
    ];

    for (const payload of fallbacks) {
      const { data: d, error: e } = await admin
        .from('subscriptions')
        .upsert(payload, { onConflict: 'barbershop_id' })
        .select()
        .single();

      if (!e) {
        return new Response(
          JSON.stringify({ ok: true, subscription: { ...d, tier } }),
          { status: 200 }
        );
      }

      // Only retry on schema-mismatch errors
      const isSchemaErr = e.message.includes('column') || e.message.includes('schema cache') || e.message.includes('violates not-null');
      if (!isSchemaErr) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, subscription: data }), { status: 200 });
};
