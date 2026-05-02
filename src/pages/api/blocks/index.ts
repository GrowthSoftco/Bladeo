import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// GET /api/blocks?date=YYYY-MM-DD&barber_id=X
// GET /api/blocks?start=YYYY-MM-DD&end=YYYY-MM-DD&barber_id=X  (range — used by month view)
export const GET: APIRoute = async ({ url, locals }) => {
  const barbershop = locals.barbershop;
  if (!barbershop) return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 });

  const admin = createAdminClient();
  const date     = url.searchParams.get('date');
  const start    = url.searchParams.get('start');
  const end      = url.searchParams.get('end');
  const barberId = url.searchParams.get('barber_id');

  let query = admin.from('barber_blocks')
    .select('*')
    .eq('barbershop_id', barbershop.id)
    .order('date').order('start_time', { nullsFirst: true });

  if (date)     query = query.eq('date', date);
  else {
    if (start)  query = query.gte('date', start);
    if (end)    query = query.lte('date', end);
  }
  if (barberId) query = query.eq('barber_id', barberId);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data ?? []), { status: 200 });
};

// POST /api/blocks
export const POST: APIRoute = async ({ request, locals }) => {
  const barbershop = locals.barbershop;
  const member     = locals.member;
  if (!barbershop || !member) return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 });

  const body = await request.json();
  const { barber_id, date, start_time, end_time, reason, full_day } = body;

  if (!barber_id || !date) {
    return new Response(JSON.stringify({ error: 'barber_id y date son requeridos.' }), { status: 400 });
  }

  // Barberos solo pueden bloquearse a sí mismos
  if (member.role === 'barber' && barber_id !== member.id) {
    return new Response(JSON.stringify({ error: 'Solo puedes bloquear tu propio horario.' }), { status: 403 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin.from('barber_blocks').insert({
    barbershop_id: barbershop.id,
    barber_id,
    date,
    start_time: full_day ? null : (start_time ?? null),
    end_time:   full_day ? null : (end_time   ?? null),
    reason:     reason?.trim() || null,
  }).select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data), { status: 201 });
};
