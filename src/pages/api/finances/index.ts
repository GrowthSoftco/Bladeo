/*
-- ============================================================
-- STEP 1: Run this migration in your Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS barber_finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'debt')),
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS barber_finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'debt')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  category_id UUID REFERENCES barber_finance_categories(id) ON DELETE SET NULL,
  category_name TEXT,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'appointment')),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bfe_member_date ON barber_finance_entries(member_id, date);
CREATE INDEX IF NOT EXISTS idx_bfc_member ON barber_finance_categories(member_id);
*/

import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

const DEFAULT_CATEGORIES = [
  { name: 'Cortes',         type: 'income',  color: '#22c55e' },
  { name: 'Propinas',       type: 'income',  color: '#a3e635' },
  { name: 'Otros ingresos', type: 'income',  color: '#6b7280' },
  { name: 'Productos',      type: 'expense', color: '#f59e0b' },
  { name: 'Transporte',     type: 'expense', color: '#3b82f6' },
  { name: 'Comida',         type: 'expense', color: '#ef4444' },
  { name: 'Renta',          type: 'expense', color: '#8b5cf6' },
  { name: 'Otros gastos',   type: 'expense', color: '#6b7280' },
  { name: 'Deuda',          type: 'debt',    color: '#dc2626' },
] as const;

async function seedDefaultCategories(memberId: string, admin: ReturnType<typeof createAdminClient>) {
  const rows = DEFAULT_CATEGORIES.map(c => ({ ...c, member_id: memberId }));
  await admin.from('barber_finance_categories').insert(rows);
}

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.member) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const start = url.searchParams.get('start');
  const end   = url.searchParams.get('end');
  const memberId = locals.member.id;

  const admin = createAdminClient();

  let entriesQuery = admin
    .from('barber_finance_entries')
    .select('*')
    .eq('member_id', memberId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (start) entriesQuery = entriesQuery.gte('date', start);
  if (end)   entriesQuery = entriesQuery.lte('date', end);

  const [{ data: entries, error: entriesError }, { data: categories, error: catsError }] = await Promise.all([
    entriesQuery,
    admin
      .from('barber_finance_categories')
      .select('*')
      .eq('member_id', memberId)
      .order('name'),
  ]);

  if (entriesError) return new Response(JSON.stringify({ error: entriesError.message }), { status: 500 });
  if (catsError)    return new Response(JSON.stringify({ error: catsError.message }),    { status: 500 });

  return new Response(JSON.stringify({ entries: entries ?? [], categories: categories ?? [] }), { status: 200 });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.member || !locals.barbershop) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const memberId     = locals.member.id;
  const barbershopId = locals.barbershop.id;
  const admin        = createAdminClient();

  // Seed default categories if member has none yet
  const { count } = await admin
    .from('barber_finance_categories')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId);

  if (count === 0) {
    await seedDefaultCategories(memberId, admin);
  }

  const body = await request.json();
  const { type, amount, category_id, category_name, description, date, source, appointment_id } = body;

  if (!type || !['income', 'expense', 'debt'].includes(type)) {
    return new Response(JSON.stringify({ error: 'Tipo inválido.' }), { status: 400 });
  }
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return new Response(JSON.stringify({ error: 'Monto inválido.' }), { status: 400 });
  }
  if (!date) {
    return new Response(JSON.stringify({ error: 'Fecha requerida.' }), { status: 400 });
  }

  const { data, error } = await admin
    .from('barber_finance_entries')
    .insert({
      member_id:      memberId,
      barbershop_id:  barbershopId,
      type,
      amount:         Number(amount),
      category_id:    category_id   || null,
      category_name:  category_name || null,
      description:    description   || null,
      date,
      source:         source        || 'manual',
      appointment_id: appointment_id || null,
    })
    .select('*')
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};
