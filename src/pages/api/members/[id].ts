import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// PUT /api/members/:id — update member
export const PUT: APIRoute = async ({ request, locals, params }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { display_name, phone, commission_pct, is_active } = body;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('members')
    .update({ display_name, phone: phone || null, commission_pct: Number(commission_pct) || 0, is_active })
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id)
    .neq('role', 'owner') // Can't edit owner via this endpoint
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

// DELETE /api/members/:id — deactivate member (soft delete)
export const DELETE: APIRoute = async ({ locals, params }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('members')
    .update({ is_active: false })
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id)
    .neq('role', 'owner');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(null, { status: 204 });
};
