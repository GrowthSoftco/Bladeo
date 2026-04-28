import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

// GET /api/sales — list sales
export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const dateFrom = url.searchParams.get('from') ?? new Date().toISOString().split('T')[0];
  const dateTo = url.searchParams.get('to') ?? dateFrom;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('sales')
    .select('*, sale_items(*), members!barber_id(display_name), clients(name)')
    .eq('barbershop_id', locals.barbershop.id)
    .gte('created_at', `${dateFrom}T00:00:00`)
    .lte('created_at', `${dateTo}T23:59:59`)
    .order('created_at', { ascending: false });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
};

// POST /api/sales — manual sale (walk-in)
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const { barber_id, client_id, items, payment_method, discount, notes } = body;

  if (!barber_id || !items || items.length === 0 || !payment_method)
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos.' }), { status: 400 });

  const subtotal = items.reduce((s: number, i: any) => s + Number(i.unit_price) * Number(i.quantity), 0);
  const discountAmt = Number(discount) || 0;
  const total = Math.max(0, subtotal - discountAmt);

  const admin = createAdminClient();

  const { data: sale, error: saleError } = await admin
    .from('sales')
    .insert({
      barbershop_id: locals.barbershop.id,
      barber_id,
      client_id: client_id || null,
      appointment_id: null,
      subtotal,
      discount: discountAmt,
      total,
      payment_method,
      notes: notes || null,
    })
    .select('id')
    .single();

  if (saleError || !sale) return new Response(JSON.stringify({ error: saleError?.message }), { status: 500 });

  // Insert sale items
  const saleItems = items.map((i: any) => ({
    sale_id: sale.id,
    item_type: i.item_type ?? 'service',
    service_id: i.service_id || null,
    product_id: i.product_id || null,
    name: i.name,
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    total: Number(i.unit_price) * Number(i.quantity),
  }));

  const { error: itemsError } = await admin.from('sale_items').insert(saleItems);
  if (itemsError) return new Response(JSON.stringify({ error: itemsError.message }), { status: 500 });

  // Decrement stock for product items
  const productItems = saleItems.filter((i: any) => i.product_id && i.item_type === 'product');
  for (const item of productItems) {
    const { data: prod } = await admin.from('products').select('stock').eq('id', item.product_id).single();
    if (prod) {
      await admin.from('products').update({ stock: Math.max(0, (prod.stock ?? 0) - item.quantity) }).eq('id', item.product_id);
    }
  }

  if (client_id) {
    const { data: clientRow } = await admin
      .from('clients')
      .select('total_visits, total_spent')
      .eq('id', client_id)
      .single();

    if (clientRow) {
      await admin
        .from('clients')
        .update({
          total_visits: (clientRow.total_visits ?? 0) + 1,
          total_spent: (clientRow.total_spent ?? 0) + total,
          last_visit_at: new Date().toISOString(),
        })
        .eq('id', client_id);
    }
  }

  const { data: fullSale } = await admin
    .from('sales')
    .select('*, sale_items(*), members!barber_id(display_name), clients(name)')
    .eq('id', sale.id)
    .single();

  return new Response(JSON.stringify(fullSale), { status: 201 });
};
