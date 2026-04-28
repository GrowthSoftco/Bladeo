import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// GET /api/public/availability?barbershop_id=X&barber_id=Y&date=YYYY-MM-DD&service_id=Z
export const GET: APIRoute = async ({ url }) => {
  const barbershopId = url.searchParams.get('barbershop_id');
  const barberId = url.searchParams.get('barber_id');
  const date = url.searchParams.get('date');
  const serviceId = url.searchParams.get('service_id');

  if (!barbershopId || !barberId || !date) {
    return new Response(JSON.stringify({ error: 'barbershop_id, barber_id y date son requeridos.' }), { status: 400 });
  }

  const admin = createAdminClient();

  // Get barbershop opening hours + service duration
  const [shopRes, serviceRes] = await Promise.all([
    admin.from('barbershops').select('opening_hours').eq('id', barbershopId).single(),
    serviceId
      ? admin.from('services').select('duration_minutes').eq('id', serviceId).single()
      : Promise.resolve({ data: null }),
  ]);

  const barbershop = shopRes.data;
  if (!barbershop) return new Response(JSON.stringify({ error: 'Barbería no encontrada.' }), { status: 404 });

  const slotDuration = (serviceRes.data as any)?.duration_minutes ?? 30;

  // Get day name from date
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  const dayName = dayNames[dayOfWeek];

  // Default Mon–Sat 8am–7pm, Sunday closed (mirrors the landing page defaults)
  const defaultHours: Record<string, { open: string; close: string } | null> = {
    monday: { open: '08:00', close: '19:00' },
    tuesday: { open: '08:00', close: '19:00' },
    wednesday: { open: '08:00', close: '19:00' },
    thursday: { open: '08:00', close: '19:00' },
    friday: { open: '08:00', close: '19:00' },
    saturday: { open: '08:00', close: '19:00' },
    sunday: null,
  };

  // Parse opening hours — fall back to defaults when owner hasn't saved custom hours
  const rawHours = barbershop.opening_hours as Record<string, { open: string; close: string } | null> | null;
  const hours = rawHours ?? defaultHours;
  const dayHours = hours[dayName];

  if (!dayHours) {
    // Closed on this day
    return new Response(JSON.stringify({ slots: [], closed: true }), { status: 200 });
  }

  const [openH, openM] = dayHours.open.split(':').map(Number);
  const [closeH, closeM] = dayHours.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Generate all possible slots
  const allSlots: string[] = [];
  for (let m = openMinutes; m + slotDuration <= closeMinutes; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    allSlots.push(`${hh}:${mm}`);
  }

  // Get existing appointments for this barber on this date
  const { data: existing } = await admin
    .from('appointments')
    .select('start_time, end_time')
    .eq('barbershop_id', barbershopId)
    .eq('barber_id', barberId)
    .eq('date', date)
    .neq('status', 'cancelled')
    .neq('status', 'no_show');

  // Filter out occupied slots
  const occupied = (existing ?? []).map((a: any) => {
    const [sh, sm] = a.start_time.split(':').map(Number);
    const [eh, em] = a.end_time.split(':').map(Number);
    return { start: sh * 60 + sm, end: eh * 60 + em };
  });

  const available = allSlots.filter(slot => {
    const [sh, sm] = slot.split(':').map(Number);
    const slotStart = sh * 60 + sm;
    const slotEnd = slotStart + slotDuration;

    // Check if this slot overlaps with any existing appointment
    return !occupied.some(a => slotStart < a.end && slotEnd > a.start);
  });

  // Don't show past slots for today (use Colombia local date to avoid UTC mismatch)
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  let filteredSlots = available;
  if (date === todayStr) {
    const nowBogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const nowMinutes = nowBogota.getHours() * 60 + nowBogota.getMinutes() + 30; // 30min buffer
    filteredSlots = available.filter(slot => {
      const [sh, sm] = slot.split(':').map(Number);
      return sh * 60 + sm >= nowMinutes;
    });
  }

  return new Response(JSON.stringify({ slots: filteredSlots, closed: false, slotDuration }), { status: 200 });
};
