import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';
import { slugify } from '@/lib/utils';

export const POST: APIRoute = async ({ request, cookies }) => {
  // Allow cross-origin requests for this endpoint
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Referer, Origin',
      },
    });
  }

  try {
    const formData = await request.formData();
    
    const email = formData.get('email') as string | null;
    const password = formData.get('password') as string | null;
    const ownerName = formData.get('ownerName') as string | null;
    const shopName = formData.get('shopName') as string | null;
    const phone = (formData.get('phone') as string) || null;
    const city = (formData.get('city') as string) || 'Pereira';

    // Debug log
    console.log('Form data received:', { email: !!email, password: !!password, ownerName, shopName });

    if (!email?.trim() || !password?.trim() || !ownerName?.trim() || !shopName?.trim()) {
      console.error('Missing fields:', { email, password, ownerName, shopName });
      return new Response('Missing required fields', { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Create auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return new Response(
        `Auth error: ${authError?.message || 'Unknown'}`,
        { status: 400 }
      );
    }

    // 2. Create barbershop
    let baseSlug = slugify(shopName);
    let slug = baseSlug;
    let attempt = 0;
    while (true) {
      const { data: existing } = await admin
        .from('barbershops')
        .select('id')
        .eq('slug', slug)
        .single();
      if (!existing) break;
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const { data: barbershop, error: shopError } = await admin
      .from('barbershops')
      .insert({ name: shopName, slug, city, phone })
      .select()
      .single();

    if (shopError || !barbershop) {
      await admin.auth.admin.deleteUser(authData.user.id);
      return new Response(`Barbershop error: ${shopError?.message}`, { status: 500 });
    }

    // 3. Create member
    const { data: memberData, error: memberError } = await admin
      .from('members')
      .insert({
        user_id: authData.user.id,
        barbershop_id: barbershop.id,
        role: 'owner',
        display_name: ownerName,
        phone,
      })
      .select()
      .single();

    if (memberError || !memberData) {
      await admin.auth.admin.deleteUser(authData.user.id);
      await admin.from('barbershops').delete().eq('id', barbershop.id);
      return new Response(`Member error: ${memberError?.message}`, { status: 500 });
    }

    // 4. Create subscription
    try {
      await admin.from('subscriptions').insert({
        barbershop_id: barbershop.id,
        stripe_customer_id: 'pending',
        plan_name: 'basic',
        status: 'incomplete',
        current_period_start: null,
        current_period_end: null,
      });
    } catch (err) {
      console.warn('Subscription insert failed:', err);
      // Don't fail registration if subscription fails
    }

    // 6. Sign in user
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: sessionData, error: sessionError } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      return new Response('Sign in failed', { status: 500 });
    }

    // 7. Set cookies and redirect to plans page
    const response = new Response(null, {
      status: 302,
      headers: {
        'Location': '/app/plans',
        'Set-Cookie': [
          `sb-access-token=${sessionData.session.access_token}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`,
          `sb-refresh-token=${sessionData.session.refresh_token}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`,
        ],
      },
    });

    return response;
  } catch (err) {
    console.error('Register error:', err);
    return new Response(`Server error: ${err}`, { status: 500 });
  }
};