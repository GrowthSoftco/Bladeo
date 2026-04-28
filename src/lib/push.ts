import webPush from 'web-push';
import { createAdminClient } from './supabase';

const vapidPublic = import.meta.env.PUBLIC_VAPID_KEY;
const vapidPrivate = import.meta.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {
  webPush.setVapidDetails('mailto:noreply@bladeo.app', vapidPublic, vapidPrivate);
} else {
  console.warn('[push] VAPID keys not set — push notifications disabled');
}

export async function sendPushToShop(
  barbershopId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
) {
  if (!vapidPublic || !vapidPrivate) return;

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('barbershop_id', barbershopId);

  if (error) {
    console.error('[push] Failed to fetch subscriptions:', error.message);
    return;
  }
  if (!subs?.length) return;

  const payloadStr = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(sub =>
      webPush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr,
        )
        .catch(async (err: any) => {
          console.error('[push] sendNotification failed:', err.statusCode, err.body);
          if (err.statusCode === 410 || err.statusCode === 404) {
            await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }),
    ),
  );
}
