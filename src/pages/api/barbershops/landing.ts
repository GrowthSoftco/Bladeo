// SQL migration:
// ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS landing_blocks JSONB DEFAULT '[]'::jsonb;

import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

const DEFAULT_BLOCKS = [
  { id: 'hero',     type: 'hero',     visible: true, content: { title: '', subtitle: '', cta_text: 'Reservar cita', cta_show: true } },
  { id: 'services', type: 'services', visible: true, content: { heading: 'Servicios', show_book_btn: true } },
  { id: 'gallery',  type: 'gallery',  visible: true, content: { heading: 'Nuestro trabajo' } },
  { id: 'booking',  type: 'booking',  visible: true, content: { heading: 'Reserva tu cita' } },
  { id: 'whatsapp', type: 'whatsapp', visible: true, content: { text: 'Reservar por WhatsApp' } },
];

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.barbershop)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('barbershops')
    .select('landing_blocks')
    .eq('id', locals.barbershop.id)
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const blocks = Array.isArray(data?.landing_blocks) && data.landing_blocks.length > 0
    ? data.landing_blocks
    : DEFAULT_BLOCKS;

  return new Response(JSON.stringify({ blocks }), { status: 200 });
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { blocks } = body;

  if (!Array.isArray(blocks))
    return new Response(JSON.stringify({ error: 'blocks must be an array' }), { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('barbershops')
    .update({ landing_blocks: blocks })
    .eq('id', locals.barbershop.id)
    .select('landing_blocks')
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ blocks: data.landing_blocks }), { status: 200 });
};
