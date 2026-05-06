import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const memberId = formData.get('member_id') as string | null;

  if (!file || !memberId)
    return new Response(JSON.stringify({ error: 'Faltan parámetros' }), { status: 400 });

  if (file.size > 5 * 1024 * 1024)
    return new Response(JSON.stringify({ error: 'Imagen demasiado grande (máx 5MB)' }), { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type))
    return new Response(JSON.stringify({ error: 'Solo se permiten JPG, PNG o WEBP' }), { status: 400 });

  const admin = createAdminClient();

  // Ensure bucket exists
  await admin.storage.createBucket('avatars', { public: true }).catch(() => {});

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${locals.barbershop.id}/${memberId}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError)
    return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 });

  const { data: urlData } = admin.storage.from('avatars').getPublicUrl(path);

  // Update member avatar_url in DB
  const { error: dbError } = await admin
    .from('members')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', memberId)
    .eq('barbershop_id', locals.barbershop.id);

  if (dbError)
    return new Response(JSON.stringify({ error: dbError.message }), { status: 500 });

  return new Response(JSON.stringify({ url: urlData.publicUrl }), { status: 200 });
};
