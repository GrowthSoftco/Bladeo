import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { name, description, price, cost, stock, sku, is_active } = body;

  if (!name || price === undefined)
    return new Response(JSON.stringify({ error: 'Nombre y precio son requeridos.' }), { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('products')
    .update({
      name,
      description: description || null,
      price: Number(price),
      cost: cost ? Number(cost) : null,
      stock: Number(stock) ?? 0,
      sku: sku || null,
      is_active: is_active ?? true,
    })
    .eq('id', params.id)
    .eq('barbershop_id', locals.barbershop.id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('products')
    .delete()
    .eq('id', params.id)
    .eq('barbershop_id', locals.barbershop.id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
