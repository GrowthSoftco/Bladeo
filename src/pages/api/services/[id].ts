import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const PUT: APIRoute = async ({ request, locals, params }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { name, description, price, duration_minutes, is_active } = body;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('services')
    .update({ name, description, price: Number(price), duration_minutes: Number(duration_minutes), is_active })
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('services')
    .delete()
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(null, { status: 204 });
};
