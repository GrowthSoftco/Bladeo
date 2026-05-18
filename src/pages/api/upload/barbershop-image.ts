import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null; // 'logo' | 'cover'

  if (!file || !type || !['logo', 'cover'].includes(type))
    return new Response(JSON.stringify({ error: 'Faltan parámetros' }), { status: 400 });

  if (file.size > 10 * 1024 * 1024)
    return new Response(JSON.stringify({ error: 'Imagen demasiado grande (máx 10MB)' }), { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type))
    return new Response(JSON.stringify({ error: 'Solo se permiten JPG, PNG o WEBP' }), { status: 400 });

  const admin = createAdminClient();
  await admin.storage.createBucket('barbershop-images', { public: true }).catch(() => {});

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${locals.barbershop.id}/${type}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from('barbershop-images')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError)
    return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 });

  const { data: urlData } = admin.storage.from('barbershop-images').getPublicUrl(path);

  // Force cache-bust by appending a timestamp
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // Update barbershop record
  const field = type === 'logo' ? 'logo_url' : 'cover_image_url';
  const { error: dbError } = await admin
    .from('barbershops')
    .update({ [field]: publicUrl })
    .eq('id', locals.barbershop.id);

  if (dbError)
    return new Response(JSON.stringify({ error: dbError.message }), { status: 500 });

  return new Response(JSON.stringify({ url: publicUrl }), { status: 200 });
};
