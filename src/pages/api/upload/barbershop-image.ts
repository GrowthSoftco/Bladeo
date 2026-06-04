import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = createAdminClient();

  // ── Auth check ──────────────────────────────────────────────────────────
  if (!locals.member) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  if (locals.member.role !== 'owner') {
    return new Response(JSON.stringify({ error: 'Solo el dueño puede subir imágenes' }), { status: 403 });
  }

  // locals.barbershop can be null if the FK join didn't resolve —
  // fall back to querying by barbershop_id directly
  let barbershopId: string = locals.barbershop?.id;

  if (!barbershopId) {
    const barbershopIdFromMember = (locals.member as any).barbershop_id;
    if (!barbershopIdFromMember) {
      return new Response(JSON.stringify({ error: 'No se encontró la barbería' }), { status: 400 });
    }
    barbershopId = barbershopIdFromMember;
  }

  // ── Parse form data ─────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error al leer el archivo enviado' }), { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null;

  if (!file || !type || !['logo', 'cover'].includes(type)) {
    return new Response(JSON.stringify({ error: 'Parámetros incorrectos' }), { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024)
    return new Response(JSON.stringify({ error: 'Imagen demasiado grande (máx 10 MB)' }), { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type))
    return new Response(JSON.stringify({ error: 'Solo se permiten JPG, PNG o WEBP' }), { status: 400 });

  // ── Ensure bucket exists ────────────────────────────────────────────────
  await admin.storage.createBucket('barbershop-images', { public: true }).catch(() => {});

  // ── Upload ──────────────────────────────────────────────────────────────
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${barbershopId}/${type}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from('barbershop-images')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error('[upload] storage error:', uploadError.message);
    return new Response(JSON.stringify({ error: `Error al subir: ${uploadError.message}` }), { status: 500 });
  }

  // ── Get public URL and save to DB ───────────────────────────────────────
  const { data: urlData } = admin.storage.from('barbershop-images').getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  const field = type === 'logo' ? 'logo_url' : 'cover_image_url';
  const { error: dbError } = await admin
    .from('barbershops')
    .update({ [field]: publicUrl })
    .eq('id', barbershopId);

  if (dbError) {
    console.error('[upload] db error:', dbError.message);
    return new Response(JSON.stringify({ error: `Imagen subida pero fallo el guardado: ${dbError.message}` }), { status: 500 });
  }

  return new Response(JSON.stringify({ url: publicUrl }), { status: 200 });
};
