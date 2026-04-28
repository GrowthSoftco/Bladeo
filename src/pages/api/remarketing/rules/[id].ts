import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

function buildTemplate(text: string, media_url?: string | null): string {
  return JSON.stringify({ text, media_url: media_url || null });
}

export const PUT: APIRoute = async ({ request, locals, params }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const body = await request.json();
  const admin = createAdminClient();

  const update: Record<string, any> = {};
  if ('name' in body) update.name = body.name;
  if ('days_after_last_visit' in body) update.days_after_last_visit = Number(body.days_after_last_visit);
  if ('is_active' in body) update.is_active = body.is_active;
  if ('message_text' in body) {
    update.message_template = buildTemplate(body.message_text, body.media_url ?? null);
  }

  const { data, error } = await admin
    .from('remarketing_rules')
    .update(update)
    .eq('id', params.id)
    .eq('barbershop_id', locals.barbershop.id)
    .select()
    .single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin
    .from('remarketing_rules')
    .delete()
    .eq('id', params.id)
    .eq('barbershop_id', locals.barbershop.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(null, { status: 204 });
};
