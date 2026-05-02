import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// GET /api/advances/settings — get min/max advance for the barbershop
export const GET: APIRoute = async ({ locals }) => {
  const { barbershop } = locals;
  if (!barbershop) return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('barbershops')
    .select('advance_min, advance_max')
    .eq('id', barbershop.id)
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({
    advance_min: Number(data?.advance_min ?? 50000),
    advance_max: Number(data?.advance_max ?? 500000),
  }), { status: 200 });
};

// PUT /api/advances/settings — update min/max (owner only)
export const PUT: APIRoute = async ({ request, locals }) => {
  const { barbershop, member } = locals;
  if (!barbershop || member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Solo el dueño puede configurar los anticipos.' }), { status: 403 });

  const admin = createAdminClient();
  const body  = await request.json();
  const { advance_min, advance_max } = body;

  if (advance_min === undefined || advance_max === undefined)
    return new Response(JSON.stringify({ error: 'advance_min y advance_max son requeridos.' }), { status: 400 });

  if (Number(advance_min) < 0 || Number(advance_max) < 0)
    return new Response(JSON.stringify({ error: 'Los valores deben ser positivos.' }), { status: 400 });

  if (Number(advance_min) > Number(advance_max))
    return new Response(JSON.stringify({ error: 'El mínimo no puede ser mayor al máximo.' }), { status: 400 });

  const { data, error } = await admin
    .from('barbershops')
    .update({ advance_min: Number(advance_min), advance_max: Number(advance_max) })
    .eq('id', barbershop.id)
    .select('advance_min, advance_max')
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data), { status: 200 });
};
