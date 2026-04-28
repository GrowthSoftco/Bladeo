import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';
import { sendPushToShop } from '@/lib/push';

// POST /api/public/book — public booking (no auth required)
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const { barbershop_id, barber_id, service_id, date, start_time, client_name, client_phone, notes } = body;

  if (!barbershop_id || !barber_id || !service_id || !date || !start_time || !client_name?.trim()) {
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos.' }), { status: 400 });
  }

  const admin = createAdminClient();

  // Get service to calculate end_time
  const { data: service } = await admin
    .from('services')
    .select('id, name, price, duration_minutes, barbershop_id, is_active')
    .eq('id', service_id)
    .eq('barbershop_id', barbershop_id)
    .single();

  if (!service || !service.is_active) {
    return new Response(JSON.stringify({ error: 'Servicio no disponible.' }), { status: 400 });
  }

  // Calculate end_time
  const [sh, sm] = start_time.split(':').map(Number);
  const endMinutes = sh * 60 + sm + service.duration_minutes;
  const end_time = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

  // Check barber belongs to barbershop
  const { data: barber } = await admin
    .from('members')
    .select('id, is_active')
    .eq('id', barber_id)
    .eq('barbershop_id', barbershop_id)
    .single();

  if (!barber || !barber.is_active) {
    return new Response(JSON.stringify({ error: 'Barbero no disponible.' }), { status: 400 });
  }

  // Check for conflicts
  const { data: conflicts } = await admin
    .from('appointments')
    .select('id')
    .eq('barbershop_id', barbershop_id)
    .eq('barber_id', barber_id)
    .eq('date', date)
    .neq('status', 'cancelled')
    .neq('status', 'no_show')
    .lt('start_time', end_time)
    .gt('end_time', start_time);

  if (conflicts && conflicts.length > 0) {
    return new Response(JSON.stringify({ error: 'Ese horario ya no está disponible. Por favor elige otro.' }), { status: 409 });
  }

  // Try to match/create a client record
  let clientId: string | null = null;
  if (client_phone?.trim()) {
    const { data: existingClient } = await admin
      .from('clients')
      .select('id')
      .eq('barbershop_id', barbershop_id)
      .eq('phone', client_phone.trim())
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      // Create new client
      const { data: newClient } = await admin
        .from('clients')
        .insert({
          barbershop_id,
          name: client_name.trim(),
          phone: client_phone.trim(),
        })
        .select('id')
        .single();
      clientId = newClient?.id ?? null;
    }
  }

  // Create appointment with 'pending' status (owner confirms)
  const { data: appointment, error } = await admin
    .from('appointments')
    .insert({
      barbershop_id,
      barber_id,
      client_id: clientId,
      service_id,
      client_name: client_name.trim(),
      client_phone: client_phone?.trim() ?? null,
      date,
      start_time,
      end_time,
      status: 'pending',
      notes: notes?.trim() ?? null,
      prepaid: false,
      prepaid_amount: 0,
    })
    .select('id, date, start_time, end_time, status, client_name')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: 'Error al crear la cita. Intenta de nuevo.' }), { status: 500 });
  }

  // Send push notification to all subscribed devices for this barbershop
  const timeLabel = `${start_time.slice(0, 5)} · ${date}`;
  await sendPushToShop(barbershop_id, {
    title: '📅 Nueva reserva',
    body: `${client_name.trim()} — ${service.name} a las ${timeLabel}`,
    url: '/app/agenda',
    tag: 'booking',
  });

  return new Response(JSON.stringify({ ok: true, appointment }), { status: 201 });
};
