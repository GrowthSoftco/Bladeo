import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// DELETE /api/blocks/:id
export const DELETE: APIRoute = async ({ params, locals }) => {
  const barbershop = locals.barbershop;
  const member     = locals.member;
  if (!barbershop || !member) return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 });

  const { id } = params;
  if (!id) return new Response(JSON.stringify({ error: 'ID requerido.' }), { status: 400 });

  const admin = createAdminClient();

  // Get the block first to validate ownership
  const { data: block } = await admin.from('barber_blocks').select('barber_id, barbershop_id').eq('id', id).single();

  if (!block || block.barbershop_id !== barbershop.id) {
    return new Response(JSON.stringify({ error: 'Bloqueo no encontrado.' }), { status: 404 });
  }

  // Barbers can only delete their own blocks
  if (member.role === 'barber' && block.barber_id !== member.id) {
    return new Response(JSON.stringify({ error: 'No tienes permiso para eliminar este bloqueo.' }), { status: 403 });
  }

  const { error } = await admin.from('barber_blocks').delete().eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(null, { status: 204 });
};
