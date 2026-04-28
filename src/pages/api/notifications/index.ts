import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify([]), { status: 200 });

  const admin = createAdminClient();
  const isOwner = locals.member?.role === 'owner';

  // Last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let query = admin
    .from('appointments')
    .select('id, client_name, status, date, start_time, created_at, services(name), members!barber_id(display_name)')
    .eq('barbershop_id', locals.barbershop.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);

  // Barbers only see their own
  if (!isOwner) {
    query = query.eq('barber_id', locals.member!.id);
  }

  const { data } = await query;

  const notifications = (data ?? []).map((apt: any) => ({
    id: apt.id,
    type: apt.status === 'pending' ? 'new_booking' : 'appointment',
    title: apt.status === 'pending' ? 'Nueva reserva online' : `Cita ${apt.status === 'completed' ? 'completada' : apt.status}`,
    body: `${apt.client_name} — ${apt.services?.name ?? 'servicio'} ${apt.status === 'pending' ? '(pendiente de confirmar)' : ''}`,
    barber: apt.members?.display_name,
    date: apt.date,
    time: apt.start_time?.slice(0, 5),
    created_at: apt.created_at,
    status: apt.status,
  }));

  return new Response(JSON.stringify(notifications), { status: 200 });
};
