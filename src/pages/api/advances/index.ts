import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// GET /api/advances?barber_id=X&status=Y
// Owner: sees all · Barber: sees own only
export const GET: APIRoute = async ({ locals, url }) => {
  const { barbershop, member } = locals;
  if (!barbershop || !member) return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 });

  const admin    = createAdminClient();
  const isOwner  = member.role === 'owner';
  const barberId = url.searchParams.get('barber_id');
  const status   = url.searchParams.get('status');

  let query = admin
    .from('advances')
    .select(`
      id, amount, status, notes, requested_at, approved_at, paid_at, created_at,
      barber:barber_id(id, display_name, commission_pct),
      approver:approved_by(id, display_name)
    `)
    .eq('barbershop_id', barbershop.id)
    .order('created_at', { ascending: false });

  // Barbers only see their own advances
  if (!isOwner) query = query.eq('barber_id', member.id);
  else if (barberId) query = query.eq('barber_id', barberId);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data ?? []), { status: 200 });
};

// POST /api/advances — create advance request
// Owner can create for any barber · Barber creates for themselves
export const POST: APIRoute = async ({ request, locals }) => {
  const { barbershop, member } = locals;
  if (!barbershop || !member) return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 });

  const admin   = createAdminClient();
  const isOwner = member.role === 'owner';
  const body    = await request.json();
  const { barber_id, amount, notes } = body;

  if (!barber_id || !amount)
    return new Response(JSON.stringify({ error: 'barber_id y amount son requeridos.' }), { status: 400 });

  // Barbers can only request for themselves
  if (!isOwner && barber_id !== member.id)
    return new Response(JSON.stringify({ error: 'Solo puedes solicitar anticipos para ti mismo.' }), { status: 403 });

  // Validate amount against barbershop limits
  const { data: shop } = await admin
    .from('barbershops')
    .select('advance_min, advance_max')
    .eq('id', barbershop.id)
    .single();

  const minAdv = Number(shop?.advance_min ?? 0);
  const maxAdv = Number(shop?.advance_max ?? Infinity);

  if (amount < minAdv)
    return new Response(JSON.stringify({ error: `El mínimo de anticipo es ${minAdv.toLocaleString('es-CO')}.` }), { status: 400 });
  if (maxAdv > 0 && amount > maxAdv)
    return new Response(JSON.stringify({ error: `El máximo de anticipo es ${maxAdv.toLocaleString('es-CO')}.` }), { status: 400 });

  const insertData: any = {
    barbershop_id: barbershop.id,
    barber_id,
    amount: Number(amount),
    notes:  notes?.trim() || null,
    status: isOwner ? 'approved' : 'pending', // Owner-created advances are auto-approved
    requested_at: new Date().toISOString(),
  };

  if (isOwner) {
    insertData.approved_at = new Date().toISOString();
    insertData.approved_by = member.id;
  }

  const { data, error } = await admin.from('advances').insert(insertData).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data), { status: 201 });
};
