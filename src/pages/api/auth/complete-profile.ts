import type { APIRoute } from 'astro';
import { createAdminClient, createServerClient } from '@/lib/supabase';
import { slugify } from '@/lib/utils';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { ownerName, shopName, phone, city } = await request.json();

    if (!ownerName || !shopName) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos.' }), { status: 400 });
    }

    const authClient = createServerClient(cookies);
    const { data: userData, error: userError } = await authClient.auth.getUser();

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const admin = createAdminClient();

    // Ensure user does not already have a member record.
    const { data: existingMember, error: existingMemberError } = await admin
      .from('members')
      .select('id')
      .eq('user_id', userData.user.id)
      .single();

    if (existingMember) {
      return new Response(JSON.stringify({ error: 'Tu cuenta ya tiene una barbería asociada.' }), { status: 400 });
    }

    let baseSlug = slugify(shopName);
    let slug = baseSlug;
    let attempt = 0;

    while (true) {
      const { data: existing } = await admin.from('barbershops').select('id').eq('slug', slug).single();
      if (!existing) break;
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const { data: barbershop, error: shopError } = await admin
      .from('barbershops')
      .insert({ name: shopName, slug, city: city || 'Pereira', phone: phone || null })
      .select()
      .single();

    if (shopError || !barbershop) {
      return new Response(JSON.stringify({ error: 'Error al crear la barbería.' }), { status: 500 });
    }

    const { error: memberError } = await admin.from('members').insert({
      user_id: userData.user.id,
      barbershop_id: barbershop.id,
      role: 'owner',
      display_name: ownerName,
      phone: phone || null,
    });

    if (memberError) {
      await admin.from('barbershops').delete().eq('id', barbershop.id);
      return new Response(JSON.stringify({ error: 'Error al configurar el perfil.' }), { status: 500 });
    }

    const { error: subscriptionError } = await admin.from('subscriptions').insert({
      barbershop_id: barbershop.id,
      stripe_customer_id: 'pending',
      plan_name: 'basic',
      status: 'incomplete',
      current_period_start: null,
      current_period_end: null,
    });

    if (subscriptionError) {
      console.warn('Subscription insert failed:', subscriptionError);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error('Complete profile error:', err);
    return new Response(JSON.stringify({ error: 'Error interno del servidor.' }), { status: 500 });
  }
};