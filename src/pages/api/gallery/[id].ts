import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// DELETE /api/gallery/:id
export const DELETE: APIRoute = async ({ locals, params }) => {
  if (!locals.barbershop)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();

  // Get the image first to extract storage path
  const { data: img, error: fetchError } = await admin
    .from('gallery_images')
    .select('image_url')
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id)
    .single();

  if (fetchError || !img)
    return new Response(JSON.stringify({ error: 'Imagen no encontrada' }), { status: 404 });

  // Extract path from public URL
  try {
    const url = new URL(img.image_url);
    const pathParts = url.pathname.split('/gallery/');
    if (pathParts[1]) {
      await admin.storage.from('gallery').remove([pathParts[1]]);
    }
  } catch (_) {}

  const { error } = await admin
    .from('gallery_images')
    .delete()
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id);

  if (error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(null, { status: 204 });
};
