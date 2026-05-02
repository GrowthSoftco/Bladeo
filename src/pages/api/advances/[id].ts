import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// PUT /api/advances/:id — update status (owner only)
// body: { status: 'approved' | 'rejected' | 'paid' }
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { barbershop, member } = locals;
  if (!barbershop || member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Solo el dueño puede actualizar anticipos.' }), { status: 403 });

  const admin  = createAdminClient();
  const { id } = params;
  const body   = await request.json();
  const { status, notes } = body;

  const validStatuses = ['approved', 'rejected', 'paid'];
  if (!status || !validStatuses.includes(status))
    return new Response(JSON.stringify({ error: 'Estado inválido. Usa: approved, rejected o paid.' }), { status: 400 });

  // Verify the advance belongs to this barbershop
  const { data: existing } = await admin
    .from('advances').select('id, status').eq('id', id).eq('barbershop_id', barbershop.id).single();

  if (!existing)
    return new Response(JSON.stringify({ error: 'Anticipo no encontrado.' }), { status: 404 });

  const update: any = { status };
  if (notes !== undefined) update.notes = notes?.trim() || null;

  if (status === 'approved') {
    update.approved_at = new Date().toISOString();
    update.approved_by = member!.id;
  }
  if (status === 'paid') {
    update.paid_at = new Date().toISOString();
    if (!existing.approved_at) {
      update.approved_at = new Date().toISOString();
      update.approved_by = member!.id;
    }
  }

  const { data, error } = await admin.from('advances').update(update).eq('id', id).select().single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify(data), { status: 200 });
};

// DELETE /api/advances/:id — cancel (owner or own barber, only if pending)
export const DELETE: APIRoute = async ({ params, locals }) => {
  const { barbershop, member } = locals;
  if (!barbershop || !member)
    return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 });

  const admin  = createAdminClient();
  const { id } = params;

  const { data: existing } = await admin
    .from('advances')
    .select('id, status, barber_id')
    .eq('id', id)
    .eq('barbershop_id', barbershop.id)
    .single();

  if (!existing)
    return new Response(JSON.stringify({ error: 'Anticipo no encontrado.' }), { status: 404 });

  const isOwner = member.role === 'owner';
  const isOwn   = existing.barber_id === member.id;

  if (!isOwner && !isOwn)
    return new Response(JSON.stringify({ error: 'No tienes permiso para eliminar este anticipo.' }), { status: 403 });

  if (!isOwner && existing.status !== 'pending')
    return new Response(JSON.stringify({ error: 'Solo puedes cancelar anticipos pendientes.' }), { status: 400 });

  const { error } = await admin.from('advances').delete().eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
