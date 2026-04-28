import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const now = new Date();
  const dateFrom = from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const dateTo = to ?? now.toISOString().split('T')[0];

  const admin = createAdminClient();
  const barbershopId = locals.barbershop.id;

  const [salesRes, itemsRes, expensesRes, barberSalesRes] = await Promise.all([
    // Total sales in range
    admin
      .from('sales')
      .select('id, total, discount, subtotal, payment_method, created_at')
      .eq('barbershop_id', barbershopId)
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`),

    // Sale items breakdown (services vs products)
    admin
      .from('sale_items')
      .select('item_type, total, sale_id')
      .in(
        'sale_id',
        (await admin
          .from('sales')
          .select('id')
          .eq('barbershop_id', barbershopId)
          .gte('created_at', `${dateFrom}T00:00:00`)
          .lte('created_at', `${dateTo}T23:59:59`)
        ).data?.map((s: any) => s.id) ?? []
      ),

    // Expenses in range
    admin
      .from('expenses')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false }),

    // Sales per barber
    admin
      .from('sales')
      .select('barber_id, total, members!barber_id(display_name)')
      .eq('barbershop_id', barbershopId)
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`),
  ]);

  const sales = salesRes.data ?? [];
  const items = itemsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const barberSales = barberSalesRes.data ?? [];

  // Totals
  const revenue = sales.reduce((s: number, r: any) => s + Number(r.total), 0);
  const discounts = sales.reduce((s: number, r: any) => s + Number(r.discount), 0);
  const totalExpenses = expenses.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const netIncome = revenue - totalExpenses;

  // Revenue by type
  const serviceRevenue = items.filter((i: any) => i.item_type === 'service').reduce((s: number, i: any) => s + Number(i.total), 0);
  const productRevenue = items.filter((i: any) => i.item_type === 'product').reduce((s: number, i: any) => s + Number(i.total), 0);

  // Revenue by payment method
  const byPayment: Record<string, number> = {};
  for (const s of sales) {
    const pm = (s as any).payment_method ?? 'otro';
    byPayment[pm] = (byPayment[pm] ?? 0) + Number((s as any).total);
  }

  // Revenue by barber
  const byBarber: Record<string, { name: string; total: number }> = {};
  for (const s of barberSales) {
    const bid = (s as any).barber_id;
    if (!byBarber[bid]) {
      byBarber[bid] = {
        name: (s as any).members?.display_name ?? 'Desconocido',
        total: 0,
      };
    }
    byBarber[bid].total += Number((s as any).total);
  }

  // Expenses by category
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    const cat = (e as any).category ?? 'Otro';
    byCategory[cat] = (byCategory[cat] ?? 0) + Number((e as any).amount);
  }

  // Daily sales chart (last 30 days or range)
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
      dateFrom,
      dateTo,
      revenue,
      discounts,
      totalExpenses,
      netIncome,
      salesCount: sales.length,
      serviceRevenue,
      productRevenue,
      byPayment,
      byBarber: Object.values(byBarber).sort((a, b) => b.total - a.total),
      byCategory,
      expenses,
      dailySales,
    }),
    { status: 200 }
  );
};
