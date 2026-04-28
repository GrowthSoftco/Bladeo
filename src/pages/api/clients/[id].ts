import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const PUT: APIRoute = async ({ request, locals, params }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { name, phone, email, notes } = body;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('clients')
    .update({ name, phone, email, notes })
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const clientId = params.id!;
  const admin = createAdminClient();

  // Nullify FK references in dependent tables before deleting the client
  // (these columns have no ON DELETE CASCADE in the schema)
  await Promise.all([
    admin.from('appointments').update({ client_id: null }).eq('client_id', clientId).eq('barbershop_id', locals.barbershop.id),
    admin.from('sales').update({ client_id: null }).eq('client_id', clientId).eq('barbershop_id', locals.barbershop.id),
    admin.from('remarketing_log').update({ client_id: null }).eq('client_id', clientId),
    admin.from('reviews').update({ client_id: null }).eq('client_id', clientId),
  ]);

  const { error } = await admin
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('barbershop_id', locals.barbershop.id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(null, { status: 204 });
};
