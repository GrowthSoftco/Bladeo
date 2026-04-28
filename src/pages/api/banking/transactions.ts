import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const dateFrom = url.searchParams.get('from') ?? new Date().toISOString().split('T')[0];
  const dateTo = url.searchParams.get('to') ?? dateFrom;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('banking_transactions')
    .select('*')
    .eq('barbershop_id', locals.barbershop.id)
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59`)
    .order('created_at', { ascending: false });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data ?? []), { status: 200 });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { transaction_type, entity, amount, commission_earned, reference, client_name, client_document, notes } = body;

  if (!transaction_type || !entity || !amount)
    return new Response(JSON.stringify({ error: 'Tipo, entidad y monto son requeridos.' }), { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('banking_transactions')
    .insert({
      barbershop_id: locals.barbershop.id,
      transaction_type,
      entity,
      amount: Number(amount),
      commission_earned: Number(commission_earned) || 0,
      reference: reference || null,
      client_name: client_name || null,
      client_document: client_document || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};
