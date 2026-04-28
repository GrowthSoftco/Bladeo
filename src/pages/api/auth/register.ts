import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';
import { slugify } from '@/lib/utils';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, password, ownerName, shopName, phone, city } = await request.json();

    if (!email || !password || !ownerName || !shopName) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos.' }), { status: 400 });
    }

    const admin = createAdminClient();

    // Create auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      const msg = authError?.message.includes('already registered')
        ? 'Ya existe una cuenta con ese correo.'
        : authError?.message ?? 'Error al crear la cuenta.';
      return new Response(JSON.stringify({ error: msg }), { status: 400 });
    }

    // Generate unique slug
    let baseSlug = slugify(shopName);
    let slug = baseSlug;
    let attempt = 0;
    while (true) {
      const { data: existing } = await admin.from('barbershops').select('id').eq('slug', slug).maybeSingle();
      if (!existing) break;
      attempt++;
      slug = `${baseSlug}-${attempt}`;
      if (attempt > 20) { slug = `${baseSlug}-${Date.now()}`; break; }
    }

    // Create barbershop
    const { data: barbershop, error: shopError } = await admin
      .from('barbershops')
      .insert({ name: shopName, slug, city: city || 'Pereira', phone: phone || null })
      .select()
      .single();

    if (shopError || !barbershop) {
      await admin.auth.admin.deleteUser(authData.user.id);
      return new Response(JSON.stringify({ error: 'Error al crear la barbería: ' + shopError?.message }), { status: 500 });
    }

    // Create member (owner)
    const { error: memberError } = await admin
      .from('members')
      .insert({
        user_id: authData.user.id,
        barbershop_id: barbershop.id,
        role: 'owner',
        display_name: ownerName,
        phone: phone || null,
      });

    if (memberError) {
      await admin.auth.admin.deleteUser(authData.user.id);
      await admin.from('barbershops').delete().eq('id', barbershop.id);
      return new Response(JSON.stringify({ error: 'Error al configurar el perfil: ' + memberError.message }), { status: 500 });
    }

    // Create subscription (incomplete — user must pay)
    await admin.from('subscriptions').insert({
      barbershop_id: barbershop.id,
      stripe_customer_id: 'pending',
      tier: 'basic',
      billing_cycle: 'monthly',
      status: 'incomplete',
    });

    // Sign in to get session tokens
    const { createClient } = await import('@supabase/supabase-js');
    const anonClient = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: sessionData, error: sessionError } = await anonClient.auth.signInWithPassword({ email, password });

    if (sessionError || !sessionData.session) {
      return new Response(JSON.stringify({ error: 'Cuenta creada. Ve a /login para iniciar sesión.' }), { status: 500 });
    }

    return new Response(JSON.stringify({ session: sessionData.session }), {
      status: 200,
      headers: {
        'Set-Cookie': [
          `sb-access-token=${sessionData.session.access_token}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`,
          `sb-refresh-token=${sessionData.session.refresh_token}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`,
        ].join(', '),
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return new Response(JSON.stringify({ error: 'Error interno del servidor.' }), { status: 500 });
  }
};
