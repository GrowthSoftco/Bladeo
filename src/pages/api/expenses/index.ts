import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const now = new Date();
  const dateFrom = from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const dateTo = to ?? now.toISOString().split('T')[0];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('expenses')
    .select('*')
    .eq('barbershop_id', locals.barbershop.id)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: false });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { category, description, amount, date } = body;

  if (!category || !amount || !date)
    return new Response(JSON.stringify({ error: 'Categoría, monto y fecha son requeridos.' }), { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('expenses')
    .insert({
      barbershop_id: locals.barbershop.id,
      category,
      description: description || null,
      amount: Number(amount),
      date,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};
