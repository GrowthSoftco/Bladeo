import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, locals }) => {
  const member = (locals as any).member;
  if (!member) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { endpoint, keys } = body?.subscription ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return new Response(JSON.stringify({ error: 'Invalid subscription object' }), { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      barbershop_id: member.barbershop_id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const member = (locals as any).member;
  if (!member) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { endpoint } = body ?? {};
  if (!endpoint) {
    return new Response(JSON.stringify({ error: 'Missing endpoint' }), { status: 400 });
  }

  const admin = createAdminClient();
  await admin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('barbershop_id', member.barbershop_id);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
