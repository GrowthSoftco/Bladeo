import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, locals }) => {
  // ── Auth check ──────────────────────────────────────────────────────────
  if (!locals.barbershop || locals.member?.role !== 'owner') {
    console.error('[upload/barbershop-image] Auth failed:', {
      hasBarbershop: !!locals.barbershop,
      memberRole: locals.member?.role,
    });
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  const barbershopId = locals.barbershop.id;

  // ── Parse form data ─────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    console.error('[upload/barbershop-image] formData parse error:', e);
    return new Response(JSON.stringify({ error: 'Error al leer el archivo' }), { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null;

  if (!file || !type || !['logo', 'cover'].includes(type)) {
    return new Response(JSON.stringify({ error: 'Faltan parámetros (file o type)' }), { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024)
    return new Response(JSON.stringify({ error: 'Imagen demasiado grande (máx 10 MB)' }), { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type))
    return new Response(JSON.stringify({ error: 'Solo JPG, PNG o WEBP' }), { status: 400 });

  // ── Upload to Supabase Storage ──────────────────────────────────────────
  const admin = createAdminClient();

  // Ensure bucket exists (public)
  const { error: bucketErr } = await admin.storage.createBucket('barbershop-images', { public: true });
  if (bucketErr && !bucketErr.message.includes('already exists')) {
    console.error('[upload/barbershop-image] createBucket error:', bucketErr);
    // Non-fatal — bucket might already exist
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${barbershopId}/${type}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from('barbershop-images')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error('[upload/barbershop-image] storage upload error:', uploadError);
    return new Response(JSON.stringify({ error: `Error al subir imagen: ${uploadError.message}` }), { status: 500 });
  }

  // ── Get public URL ──────────────────────────────────────────────────────
  const { data: urlData } = admin.storage.from('barbershop-images').getPublicUrl(path);
  // Cache-bust so the browser doesn't show a stale image
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // ── Update barbershop record ────────────────────────────────────────────
  const field = type === 'logo' ? 'logo_url' : 'cover_image_url';
  const { error: dbError } = await admin
    .from('barbershops')
    .update({ [field]: publicUrl })
    .eq('id', barbershopId);

  if (dbError) {
    console.error('[upload/barbershop-image] DB update error:', dbError);
    return new Response(JSON.stringify({ error: `Imagen subida pero no se guardó en la base de datos: ${dbError.message}` }), { status: 500 });
  }

  console.log(`[upload/barbershop-image] OK — ${field} → ${publicUrl}`);
  return new Response(JSON.stringify({ url: publicUrl }), { status: 200 });
};
