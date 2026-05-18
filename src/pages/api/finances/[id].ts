import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.member) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id } = params;
  if (!id) return new Response(JSON.stringify({ error: 'ID requerido.' }), { status: 400 });

  const admin = createAdminClient();

  // Verify ownership before deleting
  const { data: entry } = await admin
    .from('barber_finance_entries')
    .select('id')
    .eq('id', id)
    .eq('member_id', locals.member.id)
    .single();

  if (!entry) {
    return new Response(JSON.stringify({ error: 'Entrada no encontrada.' }), { status: 404 });
  }

  const { error } = await admin
    .from('barber_finance_entries')
    .delete()
    .eq('id', id)
    .eq('member_id', locals.member.id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.member) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id } = params;
  if (!id) return new Response(JSON.stringify({ error: 'ID requerido.' }), { status: 400 });

  const admin = createAdminClient();

  // Verify ownership before updating
  const { data: existing } = await admin
    .from('barber_finance_entries')
    .select('id')
    .eq('id', id)
    .eq('member_id', locals.member.id)
    .single();

  if (!existing) {
    return new Response(JSON.stringify({ error: 'Entrada no encontrada.' }), { status: 404 });
  }

  const body = await request.json();
  const { amount, description, date, category_id, category_name } = body;

  const updates: Record<string, unknown> = {};
  if (amount      !== undefined) updates.amount        = Number(amount);
  if (description !== undefined) updates.description   = description || null;
  if (date        !== undefined) updates.date          = date;
  if (category_id !== undefined) updates.category_id   = category_id || null;
  if (category_name !== undefined) updates.category_name = category_name || null;

  const { data, error } = await admin
    .from('barber_finance_entries')
    .update(updates)
    .eq('id', id)
    .eq('member_id', locals.member.id)
    .select('*')
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};
