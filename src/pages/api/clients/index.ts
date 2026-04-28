import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const search = url.searchParams.get('search') ?? '';
  const admin = createAdminClient();

  let query = admin
    .from('clients')
    .select('*')
    .eq('barbershop_id', locals.barbershop.id)
    .order('name');

  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { name, phone, email, notes } = await request.json();
  if (!name) return new Response(JSON.stringify({ error: 'El nombre es requerido.' }), { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('clients')
    .insert({ barbershop_id: locals.barbershop.id, name, phone, email, notes })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};
