import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// GET /api/members — list members of the barbershop
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('members')
    .select('id, display_name, phone, role, commission_pct, is_active, avatar_url, created_at')
    .eq('barbershop_id', locals.barbershop.id)
    .order('role')
    .order('display_name');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

// POST /api/members — create a new barber (owner only)
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { display_name, email, password, phone, commission_pct } = body;

  if (!display_name || !email || !password)
    return new Response(JSON.stringify({ error: 'Nombre, email y contraseña son requeridos.' }), { status: 400 });

  const admin = createAdminClient();

  // Check if email already registered
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const emailTaken = existingUsers?.users?.some(u => u.email === email);
  if (emailTaken) {
    // Check if they're already a member of this barbershop
    const existingUser = existingUsers.users.find(u => u.email === email);
    if (existingUser) {
      const { data: existingMember } = await admin
        .from('members')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('barbershop_id', locals.barbershop.id)
        .maybeSingle();
      if (existingMember) {
        return new Response(JSON.stringify({ error: 'Este barbero ya pertenece a tu barbería.' }), { status: 409 });
      }
    }
    return new Response(JSON.stringify({ error: 'Ya existe una cuenta con ese correo.' }), { status: 409 });
  }

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: authError?.message ?? 'Error al crear el usuario.' }), { status: 500 });
  }

  // Create member record
  const { data: member, error: memberError } = await admin
    .from('members')
    .insert({
      user_id: authData.user.id,
      barbershop_id: locals.barbershop.id,
      role: 'barber',
      display_name,
      phone: phone || null,
      commission_pct: Number(commission_pct) || 0,
      is_active: true,
    })
    .select()
    .single();

  if (memberError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return new Response(JSON.stringify({ error: memberError.message }), { status: 500 });
  }

  return new Response(JSON.stringify(member), { status: 201 });
};
