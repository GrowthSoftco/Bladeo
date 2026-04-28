-- Datos de prueba para Bladeo
-- Ejecutar después de crear las tablas

-- 1. PRIMERO: Crear usuario en Supabase Auth manualmente o usar la app
-- Usuario de prueba: test@example.com / password123
-- Una vez creado, obtén el user_id del usuario creado

-- 2. Insertar barbershop de prueba
INSERT INTO barbershops (
  name,
  slug,
  description,
  address,
  city,
  phone,
  whatsapp,
  instagram,
  opening_hours,
  payment_methods,
  payment_details
) VALUES (
  'Barbería El Estilo',
  'barberia-el-estilo',
  'La mejor barbería de Pereira con servicio premium',
  'Carrera 10 #15-20, Pereira',
  'Pereira',
  '+573001234567',
  '+573001234567',
  '@barberia_el_estilo',
  '{
    "mon": {"open": "08:00", "close": "20:00"},
    "tue": {"open": "08:00", "close": "20:00"},
    "wed": {"open": "08:00", "close": "20:00"},
    "thu": {"open": "08:00", "close": "20:00"},
    "fri": {"open": "08:00", "close": "20:00"},
    "sat": {"open": "08:00", "close": "18:00"},
    "sun": {"open": "10:00", "close": "16:00"}
  }'::jsonb,
  '["cash", "nequi", "daviplata", "bancolombia"]'::jsonb,
  '{
    "nequi": "3001234567",
    "daviplata": "3001234567",
    "bancolombia": "123-456789-0"
  }'::jsonb
);

-- 3. Insertar member (owner) - REEMPLAZA 'user-id-aqui' con el ID real del usuario creado
-- Para obtener el user_id: SELECT id FROM auth.users WHERE email = 'test@example.com';
INSERT INTO members (
  user_id,
  barbershop_id,
  role,
  display_name,
  phone,
  commission_pct
) VALUES (
  'user-id-aqui', -- ⚠️  REEMPLAZAR con el ID real del usuario
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  'owner',
  'Carlos Rodríguez',
  '+573001234567',
  0
);

-- 4. Insertar servicios de prueba
INSERT INTO services (barbershop_id, name, description, price, duration_minutes) VALUES
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Corte Clásico', 'Corte de cabello tradicional con tijeras', 25000, 30),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Corte + Barba', 'Corte de cabello + arreglo de barba completo', 40000, 45),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Solo Barba', 'Arreglo completo de barba', 20000, 20),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Corte Niño', 'Corte de cabello para niños', 20000, 25),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Tinte Cabello', 'Tinte profesional para cabello', 35000, 60);

-- 5. Insertar productos de prueba
INSERT INTO products (barbershop_id, name, description, price, cost, stock, sku) VALUES
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Shampoo Premium', 'Shampoo profesional para cabello', 15000, 8000, 20, 'SHAMP-001'),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Cera para Cabello', 'Cera modeladora profesional', 12000, 6000, 15, 'CERA-001'),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Aceite para Barba', 'Aceite hidratante para barba', 18000, 9000, 12, 'ACEITE-001'),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Cepillo Profesional', 'Cepillo para barba profesional', 8000, 4000, 8, 'CEPILLO-001');

-- 6. Insertar clientes de prueba
INSERT INTO clients (barbershop_id, name, phone, email, notes, total_visits, total_spent) VALUES
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Juan Pérez', '+573002468135', 'juan@email.com', 'Cliente regular, prefiere cortes clásicos', 5, 125000),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'María González', '+573008642579', 'maria@email.com', 'Le gusta el tinte rubio', 3, 105000),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Pedro Ramírez', '+573005791346', 'pedro@email.com', 'Cliente nuevo, primera visita', 1, 25000),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'Ana López', '+573009753468', 'ana@email.com', 'Viene con su esposo', 4, 160000);

-- 7. Insertar barberos adicionales
INSERT INTO members (
  user_id,
  barbershop_id,
  role,
  display_name,
  phone,
  commission_pct
) VALUES
('barber-1-id', (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'barber', 'Miguel Ángel', '+573006543210', 40),
('barber-2-id', (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'barber', 'David Torres', '+573007654321', 35);

-- 8. Insertar citas de prueba
INSERT INTO appointments (
  barbershop_id,
  barber_id,
  client_id,
  service_id,
  client_name,
  client_phone,
  date,
  start_time,
  end_time,
  status,
  notes
) VALUES
(
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  (SELECT id FROM members WHERE display_name = 'Carlos Rodríguez'),
  (SELECT id FROM clients WHERE name = 'Juan Pérez'),
  (SELECT id FROM services WHERE name = 'Corte Clásico'),
  'Juan Pérez',
  '+573002468135',
  CURRENT_DATE + INTERVAL '1 day',
  '10:00',
  '10:30',
  'confirmed',
  'Cliente regular'
),
(
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  (SELECT id FROM members WHERE display_name = 'Miguel Ángel'),
  (SELECT id FROM clients WHERE name = 'María González'),
  (SELECT id FROM services WHERE name = 'Tinte Cabello'),
  'María González',
  '+573008642579',
  CURRENT_DATE + INTERVAL '2 days',
  '14:00',
  '15:00',
  'pending',
  'Tinte rubio claro'
);

-- 9. Insertar configuración de lealtad
INSERT INTO loyalty_config (
  barbershop_id,
  visits_required,
  reward_type,
  reward_value,
  reward_description
) VALUES (
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  10,
  'free_service',
  NULL,
  'Corte gratis después de 10 visitas'
);

-- 10. Insertar sellos de lealtad para clientes
INSERT INTO loyalty_stamps (barbershop_id, client_id, current_stamps, total_redeemed) VALUES
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), (SELECT id FROM clients WHERE name = 'Juan Pérez'), 5, 0),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), (SELECT id FROM clients WHERE name = 'María González'), 3, 0),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), (SELECT id FROM clients WHERE name = 'Ana López'), 8, 1);

-- 11. Insertar reglas de remarketing
INSERT INTO remarketing_rules (
  barbershop_id,
  name,
  days_after_last_visit,
  message_template
) VALUES
(
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  'Recordatorio 15 días',
  15,
  'Hola {client_name}, hace {days} días no te vemos en Barbería El Estilo. ¿Quieres agendar tu próximo corte?'
),
(
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  'Recordatorio 30 días',
  30,
  'Hola {client_name}, han pasado {days} días desde tu última visita. ¡Te extrañamos! Ven por un corte nuevo.'
);

-- 12. Insertar gastos de prueba
INSERT INTO expenses (barbershop_id, category, description, amount, date) VALUES
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'arriendo', 'Pago mensual de arriendo local', 800000, CURRENT_DATE),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'servicios', 'Pago servicios públicos', 150000, CURRENT_DATE),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'productos', 'Compra de productos para venta', 200000, CURRENT_DATE - INTERVAL '7 days'),
((SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'), 'nómina', 'Pago salarios barberos', 1200000, CURRENT_DATE - INTERVAL '15 days');

-- 13. Insertar venta de prueba
INSERT INTO sales (
  barbershop_id,
  barber_id,
  client_id,
  subtotal,
  discount,
  total,
  payment_method,
  notes
) VALUES (
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  (SELECT id FROM members WHERE display_name = 'Carlos Rodríguez'),
  (SELECT id FROM clients WHERE name = 'Juan Pérez'),
  25000,
  0,
  25000,
  'cash',
  'Corte clásico pagado en efectivo'
);

-- 14. Insertar items de la venta
INSERT INTO sale_items (sale_id, item_type, service_id, name, quantity, unit_price, total) VALUES
(
  (SELECT id FROM sales LIMIT 1),
  'service',
  (SELECT id FROM services WHERE name = 'Corte Clásico'),
  'Corte Clásico',
  1,
  25000,
  25000
);

-- 15. Insertar galería de prueba
INSERT INTO gallery (barbershop_id, barber_id, image_url, caption) VALUES
(
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  (SELECT id FROM members WHERE display_name = 'Carlos Rodríguez'),
  'https://example.com/corte-1.jpg',
  'Corte moderno con degradado'
),
(
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  (SELECT id FROM members WHERE display_name = 'Miguel Ángel'),
  'https://example.com/barba-1.jpg',
  'Arreglo completo de barba'
);

-- 16. Insertar reseñas de prueba
INSERT INTO reviews (barbershop_id, barber_id, client_id, rating, comment) VALUES
(
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  (SELECT id FROM members WHERE display_name = 'Carlos Rodríguez'),
  (SELECT id FROM clients WHERE name = 'Juan Pérez'),
  5,
  'Excelente servicio, muy profesional. Recomiendo totalmente.'
),
(
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  (SELECT id FROM members WHERE display_name = 'Miguel Ángel'),
  (SELECT id FROM clients WHERE name = 'María González'),
  4,
  'Buen trabajo, pero el tiempo de espera fue un poco largo.'
);

-- 17. Insertar lista de espera de prueba
INSERT INTO waitlist (barbershop_id, barber_id, client_name, client_phone, preferred_date, preferred_time_range, status) VALUES
(
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  (SELECT id FROM members WHERE display_name = 'Carlos Rodríguez'),
  'Roberto Silva',
  '+573004567890',
  CURRENT_DATE + INTERVAL '3 days',
  'afternoon',
  'waiting'
);

-- 18. Insertar transacción bancaria de prueba
INSERT INTO banking_transactions (
  barbershop_id,
  transaction_type,
  entity,
  amount,
  commission_earned,
  reference,
  client_name,
  notes
) VALUES (
  (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
  'deposit',
  'Nequi',
  50000,
  1000,
  'REF-001',
  'Juan Pérez',
  'Depósito para pago de servicios'
);

-- 19. Insertar suscripción de prueba (después de configurar Stripe)
-- INSERT INTO subscriptions (
--   barbershop_id,
--   stripe_subscription_id,
--   stripe_customer_id,
--   plan_name,
--   status,
--   current_period_start,
--   current_period_end
-- ) VALUES (
--   (SELECT id FROM barbershops WHERE slug = 'barberia-el-estilo'),
--   'sub_test_123',
--   'cus_test_123',
--   'pro',
--   'active',
--   CURRENT_DATE,
--   CURRENT_DATE + INTERVAL '1 month'
-- );

-- 📋 INSTRUCCIONES IMPORTANTES:
-- 1. Crea el usuario test@example.com en Supabase Auth primero
-- 2. Obtén el user_id con: SELECT id FROM auth.users WHERE email = 'test@example.com';
-- 3. Reemplaza 'user-id-aqui' con el ID real
-- 4. Para los barberos adicionales, puedes crear usuarios separados o usar NULL por ahora
-- 5. Ejecuta este SQL después de crear las tablas del schema principal