import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals }) => {
  const admin = createAdminClient();

  const { data: member } = await admin
    .from('members')
    .select('id, barbershop_id, role')
    .eq('user_id', locals.user?.id ?? '')
    .single();

  const { data: subs } = await admin
    .from('subscriptions')
    .select('*')
    .eq('barbershop_id', member?.barbershop_id ?? '');

  const { data: shop } = await admin
    .from('barbershops')
    .select('id, name, payment_details, is_banking_correspondent')
    .eq('id', member?.barbershop_id ?? '')
    .single();

  return new Response(JSON.stringify({ member, subs, shop }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
