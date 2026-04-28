import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('expenses')
    .delete()
    .eq('id', params.id)
    .eq('barbershop_id', locals.barbershop.id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
