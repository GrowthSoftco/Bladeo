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
  // Get existing appointments + blocks for this barber on this date
  const [{ data: existing }, { data: blocksData }] = await Promise.all([
    admin.from('appointments')
      .select('start_time, end_time')
      .eq('barbershop_id', barbershopId)
      .eq('barber_id', barberId)
      .eq('date', date)
      .neq('status', 'cancelled')
      .neq('status', 'no_show'),
    admin.from('barber_blocks')
      .select('start_time, end_time')
      .eq('barbershop_id', barbershopId)
      .eq('barber_id', barberId)
      .eq('date', date),
  ]);

  // Full-day block → barber completely unavailable
  const hasFullDayBlock = (blocksData ?? []).some((b: any) => b.start_time === null);
  if (hasFullDayBlock) {
    return new Response(JSON.stringify({ slots: [], closed: true, blockedDay: true }), { status: 200 });
  }

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  // Occupied ranges = appointments + partial blocks
  const occupied = [
    ...(existing ?? []).map((a: any) => ({ start: toMin(a.start_time), end: toMin(a.end_time) })),
    ...(blocksData ?? []).filter((b: any) => b.start_time !== null)
      .map((b: any) => ({ start: toMin(b.start_time), end: toMin(b.end_time) })),
  ];

  const available = allSlots.filter(slot => {
    const slotStart = toMin(slot);
    const slotEnd = slotStart + slotDuration;
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
