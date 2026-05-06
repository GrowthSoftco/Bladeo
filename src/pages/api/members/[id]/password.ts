import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// POST /api/members/:id/password — owner changes a barber's password
export const POST: APIRoute = async ({ request, locals, params }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { password } = body;

  if (!password || typeof password !== 'string' || password.length < 6)
    return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres.' }), { status: 400 });

  const admin = createAdminClient();

  // Get the member to get their user_id
  const { data: member, error: fetchError } = await admin
    .from('members')
    .select('user_id')
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id)
    .single();

  if (fetchError || !member)
    return new Response(JSON.stringify({ error: 'Barbero no encontrado' }), { status: 404 });

  const { error } = await admin.auth.admin.updateUserById(member.user_id, { password });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
