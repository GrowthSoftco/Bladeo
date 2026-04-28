import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 });

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) return new Response(JSON.stringify({ error: 'Archivo demasiado grande (máx 5MB)' }), { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) return new Response(JSON.stringify({ error: 'Solo se permiten imágenes (JPG, PNG, WEBP, GIF)' }), { status: 400 });

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${locals.barbershop.id}/${Date.now()}.${ext}`;

  const admin = createAdminClient();

  // Ensure bucket exists (ignore error if already exists)
  await admin.storage.createBucket('remarketing', { public: true }).catch(() => {});

  const bytes = await file.arrayBuffer();
  const { error } = await admin.storage.from('remarketing').upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const { data: urlData } = admin.storage.from('remarketing').getPublicUrl(path);
  return new Response(JSON.stringify({ url: urlData.publicUrl }), { status: 200 });
};
