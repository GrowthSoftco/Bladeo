import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase';

export const PUT: APIRoute = async ({ request, locals, params }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const body = await request.json();
  const admin = createAdminClient();

  // Fetch current appointment first to detect status change
  const { data: current } = await admin
    .from('appointments')
    .select('*, services(id, name, price, duration_minutes)')
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id)
    .single();

  if (!current) return new Response(JSON.stringify({ error: 'Cita no encontrada.' }), { status: 404 });

  const wasNotCompleted = current.status !== 'completed';
  const becomingCompleted = body.status === 'completed';

  // Update appointment
  const { data, error } = await admin
    .from('appointments')
    .update(body)
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id)
    .select('*, services(id, name, price, duration_minutes), members!barber_id(id, display_name), clients(id, name, phone)')
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // AUTO-REGISTER SALE when appointment is completed for the first time
  if (becomingCompleted && wasNotCompleted && current.services) {
    const service = current.services as any;
    const price = Number(service.price) || 0;
    const paymentMethod = body.payment_method || 'efectivo';

    // Check if a sale already exists for this appointment
    const { data: existingSale } = await admin
      .from('sales')
      .select('id')
      .eq('appointment_id', current.id)
      .maybeSingle();

    if (!existingSale && price > 0) {
      // Create sale record
      const { data: sale, error: saleError } = await admin
        .from('sales')
        .insert({
          barbershop_id: locals.barbershop.id,
          barber_id: current.barber_id,
          client_id: current.client_id || null,
          appointment_id: current.id,
          subtotal: price,
          discount: 0,
          total: price,
          payment_method: paymentMethod,
          notes: null,
        })
        .select('id')
        .single();

      if (sale && !saleError) {
        // Create sale item
        await admin.from('sale_items').insert({
          sale_id: sale.id,
          item_type: 'service',
          service_id: service.id,
          name: service.name,
          quantity: 1,
          unit_price: price,
          total: price,
        });

        // Update client stats if appointment has a linked client
        if (current.client_id) {
          const { data: clientRow } = await admin
            .from('clients')
            .select('total_visits, total_spent')
            .eq('id', current.client_id)
            .single();
          if (clientRow) {
            await admin.from('clients').update({
              total_visits: (clientRow.total_visits ?? 0) + 1,
              total_spent: (clientRow.total_spent ?? 0) + price,
              last_visit_at: new Date().toISOString(),
            }).eq('id', current.client_id);
          }
        }
      }
    }
  }

  return new Response(JSON.stringify(data), { status: 200 });
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  if (!locals.barbershop) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', params.id!)
    .eq('barbershop_id', locals.barbershop.id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(null, { status: 204 });
};
