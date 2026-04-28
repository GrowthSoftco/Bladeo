import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

function buildTemplate(text: string, media_url?: string | null): string {
  return JSON.stringify({ text, media_url: media_url || null });
}

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('remarketing_rules')
    .select('*')
    .eq('barbershop_id', locals.barbershop.id)
    .order('created_at', { ascending: false });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const body = await request.json();
  const { name, days_after_last_visit, message_text, media_url } = body;
  if (!name || !days_after_last_visit || !message_text)
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos.' }), { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('remarketing_rules')
    .insert({
      barbershop_id: locals.barbershop.id,
      name,
      days_after_last_visit: Number(days_after_last_visit),
      message_template: buildTemplate(message_text, media_url),
      is_active: true,
    })
    .select()
    .single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 201 });
};
