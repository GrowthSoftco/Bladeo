import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.barbershop || locals.member?.role !== 'owner')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const from = url.searchParams.get('from') ?? new Date().toISOString().split('T')[0];
  const to = url.searchParams.get('to') ?? from;

  const admin = createAdminClient();
  const barbershopId = locals.barbershop.id;
  const barbershopName = locals.barbershop.name;

  const saleIds = (await admin.from('sales').select('id').eq('barbershop_id', barbershopId)
    .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)).data?.map((s: any) => s.id) ?? [];

  const [salesRes, expensesRes, barberSalesRes] = await Promise.all([
    admin.from('sales').select('id, total, discount, payment_method, created_at').eq('barbershop_id', barbershopId)
      .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`).order('created_at', { ascending: true }),
    admin.from('expenses').select('*').eq('barbershop_id', barbershopId).gte('date', from).lte('date', to).order('date', { ascending: true }),
    admin.from('sales').select('barber_id, total, members!barber_id(display_name)').eq('barbershop_id', barbershopId)
      .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`),
  ]);

  const sales = salesRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const barberSales = barberSalesRes.data ?? [];

  const revenue = sales.reduce((s: number, r: any) => s + Number(r.total), 0);
  const discounts = sales.reduce((s: number, r: any) => s + Number(r.discount || 0), 0);
  const totalExpenses = expenses.reduce((s: number, r: any) => s + Number(r.amount), 0);
  const netIncome = revenue - totalExpenses;

  const byPayment: Record<string, number> = {};
  for (const s of sales) {
    const pm = (s as any).payment_method ?? 'otro';
    byPayment[pm] = (byPayment[pm] ?? 0) + Number((s as any).total);
  }

  const byBarber: Record<string, { name: string; total: number }> = {};
  for (const s of barberSales) {
    const bid = (s as any).barber_id;
    if (!byBarber[bid]) byBarber[bid] = { name: (s as any).members?.display_name ?? 'Desconocido', total: 0 };
    byBarber[bid].total += Number((s as any).total);
  }

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    const cat = (e as any).category ?? 'Otro';
    byCategory[cat] = (byCategory[cat] ?? 0) + Number((e as any).amount);
  }

  const generatedAt = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const periodLabel = from === to ? fmtDate(from) : `${fmtDate(from)} — ${fmtDate(to)}`;

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Efectivo', efectivo: 'Efectivo', nequi: 'Nequi', bancolombia: 'Bancolombia',
    daviplata: 'Daviplata', card: 'Tarjeta', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
  };

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte — ${barbershopName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 32px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #111; }
    .header h1 { font-size: 22px; font-weight: 700; }
    .header .meta { text-align: right; color: #555; font-size: 11px; line-height: 1.6; }
    .period { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .stat { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px 16px; }
    .stat .label { font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .stat .value { font-size: 18px; font-weight: 700; }
    .stat.green .value { color: #16a34a; }
    .stat.red .value { color: #dc2626; }
    .stat.blue .value { color: #2563eb; }
    section { margin-bottom: 24px; }
    section h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 7px 10px; background: #f0f0f0; font-weight: 600; color: #444; border-bottom: 1px solid #ddd; }
    td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; color: #333; }
    tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #999; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${barbershopName}</h1>
      <div style="font-size:11px;color:#777;margin-top:4px">Reporte de Contabilidad</div>
    </div>
    <div class="meta">
      <div>Generado: ${generatedAt}</div>
      <div>Período: ${periodLabel}</div>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat blue">
      <div class="label">Ingresos brutos</div>
      <div class="value">${fmt(revenue)}</div>
    </div>
    <div class="stat red">
      <div class="label">Gastos</div>
      <div class="value">${fmt(totalExpenses)}</div>
    </div>
    <div class="stat ${netIncome >= 0 ? 'green' : 'red'}">
      <div class="label">Utilidad neta</div>
      <div class="value">${fmt(netIncome)}</div>
    </div>
    <div class="stat">
      <div class="label">Transacciones</div>
      <div class="value">${sales.length}</div>
    </div>
  </div>

  ${Object.keys(byPayment).length > 0 ? `
  <section>
    <h2>Ingresos por método de pago</h2>
    <table>
      <thead><tr><th>Método</th><th class="text-right">Total</th></tr></thead>
      <tbody>
        ${Object.entries(byPayment).sort(([,a],[,b]) => b-a).map(([pm, amt]) =>
          `<tr><td>${PAYMENT_LABELS[pm] ?? pm}</td><td class="text-right">${fmt(amt)}</td></tr>`
        ).join('')}
      </tbody>
    </table>
  </section>` : ''}

  ${Object.keys(byBarber).length > 0 ? `
  <section>
    <h2>Ingresos por barbero</h2>
    <table>
      <thead><tr><th>Barbero</th><th class="text-right">Total</th></tr></thead>
      <tbody>
        ${Object.values(byBarber).sort((a,b) => b.total-a.total).map(b =>
          `<tr><td>${b.name}</td><td class="text-right">${fmt(b.total)}</td></tr>`
        ).join('')}
      </tbody>
    </table>
  </section>` : ''}

  ${expenses.length > 0 ? `
  <section>
    <h2>Gastos del período</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="text-right">Monto</th></tr></thead>
      <tbody>
        ${expenses.map((e: any) =>
          `<tr><td>${fmtDate(e.date)}</td><td>${e.category}</td><td>${e.description || '—'}</td><td class="text-right">${fmt(e.amount)}</td></tr>`
        ).join('')}
        <tr style="font-weight:700;background:#f8f8f8"><td colspan="3">Total gastos</td><td class="text-right">${fmt(totalExpenses)}</td></tr>
      </tbody>
    </table>
  </section>` : '<section><h2>Gastos</h2><p style="color:#999;font-size:11px">Sin gastos registrados en este período.</p></section>'}

  ${Object.keys(byCategory).length > 0 ? `
  <section>
    <h2>Gastos por categoría</h2>
    <table>
      <thead><tr><th>Categoría</th><th class="text-right">Total</th></tr></thead>
      <tbody>
        ${Object.entries(byCategory).sort(([,a],[,b]) => b-a).map(([cat, amt]) =>
          `<tr><td>${cat}</td><td class="text-right">${fmt(amt)}</td></tr>`
        ).join('')}
      </tbody>
    </table>
  </section>` : ''}

  <div class="footer">Bladeo · Reporte generado automáticamente · ${generatedAt}</div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="reporte-${from}.html"`,
    },
  });
};
