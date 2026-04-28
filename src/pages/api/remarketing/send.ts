import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { to, message, media_url } = body;

  if (!to?.trim() || !message?.trim())
    return new Response(JSON.stringify({ error: 'Número y mensaje son requeridos.' }), { status: 400 });

  const admin = createAdminClient();
  const { data: shopData } = await admin
    .from('barbershops')
    .select('payment_details')
    .eq('id', locals.barbershop.id)
    .single();

  const twilio = (shopData?.payment_details as any)?._twilio;
  if (!twilio?.account_sid || !twilio?.auth_token || !twilio?.whatsapp_from)
    return new Response(JSON.stringify({ error: 'Twilio no está configurado.' }), { status: 400 });

  const channel = (body.channel === 'sms') ? 'sms' : 'whatsapp';

  let toNumber = to.trim().replace(/\s/g, '');
  if (!toNumber.startsWith('+')) toNumber = '+' + toNumber;

  const baseFrom = twilio.whatsapp_from.replace(/^whatsapp:/, '');
  let fromNumber: string;

  if (channel === 'whatsapp') {
    fromNumber = 'whatsapp:' + baseFrom;
    toNumber = 'whatsapp:' + toNumber;
  } else {
    fromNumber = twilio.sms_from?.trim() || baseFrom;
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilio.account_sid}/Messages.json`;
  const params = new URLSearchParams({ From: fromNumber, To: toNumber, Body: message });
  if (media_url?.trim()) params.append('MediaUrl', media_url.trim());

  const credentials = Buffer.from(`${twilio.account_sid}:${twilio.auth_token}`).toString('base64');

  const twilioRes = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const twilioData = await twilioRes.json() as any;

  // Twilio error codes reference
  // 63016 = recipient not opted-in to WhatsApp sandbox
  if (!twilioRes.ok) {
    const code = twilioData.code;
    let userMsg = twilioData.message ?? 'Error al enviar mensaje.';
    if (code === 63016 || code === 21612) {
      userMsg = 'El destinatario no ha aceptado mensajes de WhatsApp. Debe enviar primero "join <sandbox-keyword>" al número de Twilio.';
    } else if (code === 21211) {
      userMsg = 'Número de teléfono inválido. Verifica el formato (+57...).';
    } else if (code === 21608) {
      userMsg = 'Número no verificado. En cuentas de prueba solo puedes enviar a números verificados en Twilio.';
    }
    // Log failed attempt
    try { await admin.from('remarketing_log').insert({ barbershop_id: locals.barbershop.id, rule_id: null, client_id: null, scheduled_date: new Date().toISOString().split('T')[0], status: 'failed' }); } catch(_) {}
    return new Response(JSON.stringify({ error: userMsg, twilio_code: code }), { status: 400 });
  }

  // Log successful send
  try { await admin.from('remarketing_log').insert({ barbershop_id: locals.barbershop.id, rule_id: null, client_id: null, scheduled_date: new Date().toISOString().split('T')[0], status: twilioData.status === 'failed' ? 'failed' : 'sent' }); } catch(_) {}

  return new Response(JSON.stringify({
    ok: true,
    sid: twilioData.sid,
    status: twilioData.status,
    to: twilioData.to,
    error_code: twilioData.error_code ?? null,
    error_message: twilioData.error_message ?? null,
    price: twilioData.price ?? null,
    from: fromNumber,
  }), { status: 200 });
};
