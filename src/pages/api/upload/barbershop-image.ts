import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

const BUCKET = 'barbershop-images';

export const POST: APIRoute = async ({ request, locals }) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!locals.member || locals.member.role !== 'owner') {
    return json({ error: 'No autorizado' }, 401);
  }

  const barbershopId =
    locals.barbershop?.id ??
    (locals.member as any).barbershop_id;

  if (!barbershopId) return json({ error: 'Barbería no encontrada' }, 400);

  const admin = createAdminClient();

  // Ensure bucket exists
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const { step, type } = body;
  if (!['logo', 'cover'].includes(type)) return json({ error: 'type inválido' }, 400);

  /* ── STEP 1: generate a signed upload URL ─────────────────────────────── */
  if (step === 1) {
    const ext = body.contentType === 'image/png' ? 'png'
              : body.contentType === 'image/webp' ? 'webp' : 'jpg';
    const path = `${barbershopId}/${type}.${ext}`;

    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error) return json({ error: error.message }, 500);
    return json({ signedUrl: data.signedUrl, path });
  }

  /* ── STEP 2: save public URL to DB after upload ───────────────────────── */
  if (step === 2) {
    const { path } = body;
    if (!path) return json({ error: 'path requerido' }, 400);

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const field = type === 'logo' ? 'logo_url' : 'cover_image_url';
    const { error } = await admin
      .from('barbershops')
      .update({ [field]: publicUrl })
      .eq('id', barbershopId);

    if (error) return json({ error: error.message }, 500);
    return json({ url: publicUrl });
  }

  return json({ error: 'step inválido' }, 400);
};

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
