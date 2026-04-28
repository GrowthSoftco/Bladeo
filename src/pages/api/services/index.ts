import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// GET /api/services — list services for the current barbershop
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('services')
    .select('*')
    .eq('barbershop_id', locals.barbershop.id)
    .order('name');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

// POST /api/services — create a service
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { name, description, price, duration_minutes } = body;

  if (!name || !price || !duration_minutes)
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos.' }), { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('services')
    .insert({ barbershop_id: locals.barbershop.id, name, description, price: Number(price), duration_minutes: Number(duration_minutes) })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};
