import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('products')
    .select('*')
    .eq('barbershop_id', locals.barbershop.id)
    .order('name');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { name, description, price, cost, stock, sku } = body;

  if (!name || price === undefined)
    return new Response(JSON.stringify({ error: 'Nombre y precio son requeridos.' }), { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('products')
    .insert({
      barbershop_id: locals.barbershop.id,
      name,
      description: description || null,
      price: Number(price),
      cost: cost ? Number(cost) : null,
      stock: Number(stock) || 0,
      sku: sku || null,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};
