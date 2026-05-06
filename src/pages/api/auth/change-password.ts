import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, locals }) => {
  const member = locals.member;
  if (!member) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });

  const body = await request.json();
  const { password } = body;

  if (!password || typeof password !== 'string' || password.length < 6) {
    return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres.' }), { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(member.user_id, { password });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
