import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const admin = createAdminClient();
  const shopId = locals.barbershop.id;

  // Active rules count
  const { count: activeRules } = await admin
    .from('remarketing_rules')
    .select('*', { count: 'exact', head: true })
    .eq('barbershop_id', shopId)
    .eq('is_active', true);

  // Total clients
  const { count: totalClients } = await admin
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('barbershop_id', shopId);

  // Inactive clients (no visit in 30+ days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: inactiveClients } = await admin
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('barbershop_id', shopId)
    .or(`last_visit_at.lt.${thirtyDaysAgo},last_visit_at.is.null`);

  // Log stats
  const { count: sentTotal } = await admin
    .from('remarketing_log')
    .select('*', { count: 'exact', head: true })
    .eq('barbershop_id', shopId)
    .eq('status', 'sent');

  const { count: pendingTotal } = await admin
    .from('remarketing_log')
    .select('*', { count: 'exact', head: true })
    .eq('barbershop_id', shopId)
    .eq('status', 'pending');

  // Recent logs with client info
  const { data: recentLogs } = await admin
    .from('remarketing_log')
    .select('*, clients(name, phone), remarketing_rules(name)')
    .eq('barbershop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(20);

  return new Response(JSON.stringify({
    activeRules: activeRules ?? 0,
    totalClients: totalClients ?? 0,
    inactiveClients: inactiveClients ?? 0,
    sentTotal: sentTotal ?? 0,
    pendingTotal: pendingTotal ?? 0,
    recentLogs: recentLogs ?? [],
  }), { status: 200 });
};
