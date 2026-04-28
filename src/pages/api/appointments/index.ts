import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const date = url.searchParams.get('date');
  const startDate = url.searchParams.get('start');
  const endDate = url.searchParams.get('end');
  const barberId = url.searchParams.get('barber_id');

  const admin = createAdminClient();
  let query = admin
    .from('appointments')
    .select('*, services(id, name, price, duration_minutes), members!barber_id(id, display_name, avatar_url), clients(id, name, phone)')
    .eq('barbershop_id', locals.barbershop.id)
    .order('date')
    .order('start_time');

  if (date) query = query.eq('date', date);
  if (startDate && endDate) query = query.gte('date', startDate).lte('date', endDate);
  if (barberId) query = query.eq('barber_id', barberId);

  // Barbers only see their own
  if (locals.member?.role === 'barber') {
    query = query.eq('barber_id', locals.member.id);
  }

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { barber_id, client_id, service_id, client_name, client_phone, date, start_time, end_time, notes, prepaid, prepaid_amount, payment_method } = body;

  if (!barber_id || !service_id || !client_name || !date || !start_time || !end_time)
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos.' }), { status: 400 });

  const admin = createAdminClient();

  // Check for conflicts
  const { data: conflicts } = await admin
    .from('appointments')
    .select('id')
    .eq('barbershop_id', locals.barbershop.id)
    .eq('barber_id', barber_id)
    .eq('date', date)
    .neq('status', 'cancelled')
    .neq('status', 'no_show')
    .or(`start_time.lt.${end_time},end_time.gt.${start_time}`);

  if (conflicts && conflicts.length > 0)
    return new Response(JSON.stringify({ error: 'El barbero ya tiene una cita en ese horario.' }), { status: 409 });

  const { data, error } = await admin
    .from('appointments')
    .insert({
      barbershop_id: locals.barbershop.id,
      barber_id,
      client_id: client_id || null,
      service_id,
      client_name,
      client_phone: client_phone || null,
      date,
      start_time,
      end_time,
      status: 'confirmed',
      notes: notes || null,
      prepaid: prepaid ?? false,
      prepaid_amount: prepaid_amount ?? 0,
      payment_method: payment_method || null,
    })
    .select('*, services(id, name, price, duration_minutes), members!barber_id(id, display_name), clients(id, name, phone)')
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};
