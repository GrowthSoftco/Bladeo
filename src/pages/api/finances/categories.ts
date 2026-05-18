import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.member) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('barber_finance_categories')
    .select('*')
    .eq('member_id', locals.member.id)
    .order('name');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data ?? []), { status: 200 });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.member) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const { name, type, color } = body;

  if (!name || !name.trim()) {
    return new Response(JSON.stringify({ error: 'Nombre requerido.' }), { status: 400 });
  }
  if (!type || !['income', 'expense', 'debt'].includes(type)) {
    return new Response(JSON.stringify({ error: 'Tipo inválido.' }), { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('barber_finance_categories')
    .insert({
      member_id: locals.member.id,
      name:      name.trim(),
      type,
      color:     color || '#6b7280',
    })
    .select('*')
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};

export const DELETE: APIRoute = async ({ url, locals }) => {
  if (!locals.member) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'ID requerido.' }), { status: 400 });

  const admin = createAdminClient();

  // Verify ownership
  const { data: cat } = await admin
    .from('barber_finance_categories')
    .select('id')
    .eq('id', id)
    .eq('member_id', locals.member.id)
    .single();

  if (!cat) {
    return new Response(JSON.stringify({ error: 'Categoría no encontrada.' }), { status: 404 });
  }

  const { error } = await admin
    .from('barber_finance_categories')
    .delete()
    .eq('id', id)
    .eq('member_id', locals.member.id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
