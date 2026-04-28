import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.barbershop)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  if (params.id !== locals.barbershop.id)
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('barbershops')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  if (params.id !== locals.barbershop.id)
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const body = await request.json();
  const { name, slug, description, phone, whatsapp, instagram, city, address, logo_url, cover_image_url } = body;

  if (!name?.trim())
    return new Response(JSON.stringify({ error: 'Nombre requerido.' }), { status: 400 });

  // Check slug uniqueness (ignore own barbershop)
  if (slug) {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('barbershops')
      .select('id')
      .eq('slug', slug.trim())
      .neq('id', params.id)
      .maybeSingle();
    if (existing)
      return new Response(JSON.stringify({ error: 'Ese slug ya está en uso.' }), { status: 409 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('barbershops')
    .update({
      name: name.trim(),
      slug: slug?.trim() ?? locals.barbershop.slug,
      description: description?.trim() || null,
      phone: phone?.trim() || null,
      whatsapp: whatsapp?.trim() || null,
      instagram: instagram?.trim() || null,
      city: city?.trim() || locals.barbershop.city,
      address: address?.trim() || null,
      logo_url: logo_url?.trim() || null,
      cover_image_url: cover_image_url?.trim() || null,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  // For partial updates like toggling banking correspondent, opening_hours, etc.
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  if (params.id !== locals.barbershop.id)
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });

  const body = await request.json();
  const admin = createAdminClient();

  // banking_entity is stored in payment_details._banking_entity (no dedicated column)
  if ('banking_entity' in body) {
    const entity = body.banking_entity ?? null;
    const { data: cur } = await admin.from('barbershops').select('payment_details').eq('id', params.id).single();
    const merged = { ...(cur?.payment_details ?? {}), _banking_entity: entity };
    const { data: d, error: e } = await admin.from('barbershops').update({ payment_details: merged }).eq('id', params.id).select().single();
    if (e) return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    return new Response(JSON.stringify({ ...d, banking_entity: entity }), { status: 200 });
  }

  // All partial updates including is_banking_correspondent
  const allowedFields = ['is_banking_correspondent', 'opening_hours', 'logo_url', 'cover_image_url', 'payment_methods', 'payment_details'];
  const patch: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0)
    return new Response(JSON.stringify({ error: 'Nada que actualizar.' }), { status: 400 });

  const { data, error } = await admin
    .from('barbershops')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};
