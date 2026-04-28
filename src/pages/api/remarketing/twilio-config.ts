import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// GET — returns masked config (or null if not set)
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const admin = createAdminClient();
  const { data } = await admin.from('barbershops').select('payment_details').eq('id', locals.barbershop.id).single();
  const twilio = (data?.payment_details as any)?._twilio ?? null;
  if (!twilio) return new Response(JSON.stringify({ configured: false }), { status: 200 });
  // Return masked values
  return new Response(JSON.stringify({
    configured: true,
    account_sid_hint: twilio.account_sid ? '••••••' + twilio.account_sid.slice(-4) : null,
    whatsapp_from: twilio.whatsapp_from ?? null,
  }), { status: 200 });
};

// POST — save Twilio credentials
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { account_sid, auth_token, whatsapp_from, sms_from } = body;

  if (!account_sid?.trim() || !auth_token?.trim() || !whatsapp_from?.trim())
    return new Response(JSON.stringify({ error: 'Todos los campos son requeridos.' }), { status: 400 });

  const admin = createAdminClient();
  const { data: cur } = await admin.from('barbershops').select('payment_details').eq('id', locals.barbershop.id).single();
  const merged = {
    ...(cur?.payment_details ?? {}),
    _twilio: {
      account_sid: account_sid.trim(),
      auth_token: auth_token.trim(),
      whatsapp_from: whatsapp_from.trim(),
      sms_from: sms_from?.trim() || null,
    },
  };
  const { error } = await admin.from('barbershops').update({ payment_details: merged }).eq('id', locals.barbershop.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

// DELETE — remove Twilio config
export const DELETE: APIRoute = async ({ locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const admin = createAdminClient();
  const { data: cur } = await admin.from('barbershops').select('payment_details').eq('id', locals.barbershop.id).single();
  const details = { ...(cur?.payment_details ?? {}) };
  delete (details as any)._twilio;
  await admin.from('barbershops').update({ payment_details: details }).eq('id', locals.barbershop.id);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
