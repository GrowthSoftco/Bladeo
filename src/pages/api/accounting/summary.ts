import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const from      = url.searchParams.get('from');
  const to        = url.searchParams.get('to');
  const barberId  = url.searchParams.get('barber_id') || null;

  const now = new Date();
  const dateFrom = from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const dateTo   = to   ?? now.toISOString().split('T')[0];

  const admin        = createAdminClient();
  const barbershopId = locals.barbershop.id;

  // ── Resolve sale IDs (needed for sale_items join) ──────────────────────────
  let saleIdQuery = admin
    .from('sales')
    .select('id')
    .eq('barbershop_id', barbershopId)
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59`);
  if (barberId) saleIdQuery = saleIdQuery.eq('barber_id', barberId);
  const saleIds = ((await saleIdQuery).data ?? []).map((s: any) => s.id);

  // ── Main queries ───────────────────────────────────────────────────────────
  let salesQuery = admin
    .from('sales')
    .select('id, total, discount, subtotal, payment_method, created_at')
    .eq('barbershop_id', barbershopId)
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59`);
  if (barberId) salesQuery = salesQuery.eq('barber_id', barberId);

  let barberSalesQuery = admin
    .from('sales')
    .select('barber_id, total, members!barber_id(display_name, commission_pct)')
    .eq('barbershop_id', barbershopId)
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59`);
  if (barberId) barberSalesQuery = barberSalesQuery.eq('barber_id', barberId);

  // Approved advances not yet paid (to deduct from barber earnings)
  let advancesQuery = admin
    .from('advances')
    .select('barber_id, amount')
    .eq('barbershop_id', barbershopId)
    .eq('status', 'approved'); // approved but not yet paid = still outstanding
  if (barberId) advancesQuery = advancesQuery.eq('barber_id', barberId);

  const [salesRes, itemsRes, expensesRes, barberSalesRes, memberRes, advancesRes] = await Promise.all([
    salesQuery,

    // Sale items breakdown
    saleIds.length > 0
      ? admin.from('sale_items').select('item_type, total, sale_id').in('sale_id', saleIds)
      : Promise.resolve({ data: [] }),

    // Expenses — always barbershop-wide (not per-barber)
    admin
      .from('expenses')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false }),

    barberSalesQuery,

    // If filtering by barber, fetch their commission_pct
    barberId
      ? admin.from('members').select('id, display_name, commission_pct').eq('id', barberId).single()
      : Promise.resolve({ data: null }),

    // Outstanding approved advances per barber
    advancesQuery,
  ]);

  const sales       = salesRes.data       ?? [];
  const items       = itemsRes.data       ?? [];
  const expenses    = expensesRes.data    ?? [];
  const barberSales = barberSalesRes.data ?? [];
  const advancesData = advancesRes.data   ?? [];

  // Build a map of outstanding advances per barber_id
  const advancesByBarber: Record<string, number> = {};
  for (const adv of advancesData) {
    const bid = (adv as any).barber_id;
    advancesByBarber[bid] = (advancesByBarber[bid] ?? 0) + Number((adv as any).amount);
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const revenue       = sales.reduce((s: number, r: any) => s + Number(r.total), 0);
  const discounts     = sales.reduce((s: number, r: any) => s + Number(r.discount), 0);
  const totalExpenses = expenses.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const netIncome     = revenue - totalExpenses;

  // ── Revenue by type ────────────────────────────────────────────────────────
  const serviceRevenue = items.filter((i: any) => i.item_type === 'service').reduce((s: number, i: any) => s + Number(i.total), 0);
  const productRevenue = items.filter((i: any) => i.item_type === 'product').reduce((s: number, i: any) => s + Number(i.total), 0);

  // ── Revenue by payment method ──────────────────────────────────────────────
  const byPayment: Record<string, number> = {};
  for (const s of sales) {
    const pm = (s as any).payment_method ?? 'otro';
    byPayment[pm] = (byPayment[pm] ?? 0) + Number((s as any).total);
  }

  // ── Revenue by barber ──────────────────────────────────────────────────────
  const byBarberMap: Record<string, { name: string; total: number; commissionPct: number }> = {};
  for (const s of barberSales) {
    const bid = (s as any).barber_id;
    if (!byBarberMap[bid]) {
      byBarberMap[bid] = {
        name: (s as any).members?.display_name ?? 'Desconocido',
        total: 0,
        commissionPct: Number((s as any).members?.commission_pct ?? 0),
      };
    }
    byBarberMap[bid].total += Number((s as any).total);
  }
  const byBarber = Object.entries(byBarberMap)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([bid, b]) => {
      const barberCut = b.total * b.commissionPct / 100;
      const ownerCut  = b.total * (1 - b.commissionPct / 100);
      const advances  = advancesByBarber[bid] ?? 0;
      return {
        ...b,
        barberCut,
        ownerCut,
        advances,                         // outstanding approved advances
        netPayout: barberCut - advances,  // what the barber actually receives
      };
    });

  // ── Commission breakdown (only when filtering by a specific barber) ─────────
  const barberMember    = (memberRes as any)?.data ?? null;
  const commissionPct   = barberMember ? Number(barberMember.commission_pct ?? 0) : null;
  const barberEarnings  = commissionPct !== null ? revenue * commissionPct / 100       : null;
  const ownerFromBarber = commissionPct !== null ? revenue * (1 - commissionPct / 100) : null;
  const barberAdvances  = barberId ? (advancesByBarber[barberId] ?? 0) : null;
  const barberNetPayout = barberEarnings !== null && barberAdvances !== null
    ? barberEarnings - barberAdvances
    : null;

  // ── Expenses by category ───────────────────────────────────────────────────
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    const cat = (e as any).category ?? 'Otro';
    byCategory[cat] = (byCategory[cat] ?? 0) + Number((e as any).amount);
  }

  // ── Daily sales chart ──────────────────────────────────────────────────────
  const dailyMap: Record<string, number> = {};
  for (const s of sales) {
    const day = (s as any).created_at.split('T')[0];
    dailyMap[day] = (dailyMap[day] ?? 0) + Number((s as any).total);
  }
  const dailySales = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  return new Response(
    JSON.stringify({
      dateFrom, dateTo,
      revenue, discounts, totalExpenses, netIncome,
      salesCount: sales.length,
      serviceRevenue, productRevenue,
      byPayment,
      byBarber,
      byCategory,
      expenses: barberId ? [] : expenses, // expenses are barbershop-wide; hide in barber view
      allExpenses: expenses,              // always available for the expenses tab
      dailySales,
      // Barber-specific fields (null when not filtered)
      filteredBarberId: barberId,
      barberName: barberMember?.display_name ?? null,
      commissionPct,
      barberEarnings,
      ownerFromBarber,
      barberAdvances,
      barberNetPayout,
    }),
    { status: 200 }
  );
};
