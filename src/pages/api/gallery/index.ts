import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// GET /api/gallery — list gallery images
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.barbershop)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('gallery_images')
    .select('*, barber:members(id, display_name, avatar_url)')
    .eq('barbershop_id', locals.barbershop.id)
    .order('created_at', { ascending: false });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data ?? []), { status: 200 });
};

// POST /api/gallery — upload a new photo
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const caption = (formData.get('caption') as string | null) ?? null;
  const barber_id = (formData.get('barber_id') as string | null) || null;

  if (!file)
    return new Response(JSON.stringify({ error: 'No se proporcionó imagen' }), { status: 400 });

  if (file.size > 10 * 1024 * 1024)
    return new Response(JSON.stringify({ error: 'Imagen demasiado grande (máx 10MB)' }), { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type))
    return new Response(JSON.stringify({ error: 'Solo se permiten JPG, PNG o WEBP' }), { status: 400 });

  const admin = createAdminClient();

  // Ensure bucket exists
  await admin.storage.createBucket('gallery', { public: true }).catch(() => {});

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${locals.barbershop.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from('gallery')
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadError)
    return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 });

  const { data: urlData } = admin.storage.from('gallery').getPublicUrl(path);

  const { data, error: dbError } = await admin
    .from('gallery_images')
    .insert({
      barbershop_id: locals.barbershop.id,
      barber_id: barber_id || null,
      image_url: urlData.publicUrl,
      caption: caption || null,
    })
    .select()
    .single();

  if (dbError)
    return new Response(JSON.stringify({ error: dbError.message }), { status: 500 });

  return new Response(JSON.stringify(data), { status: 201 });
};
