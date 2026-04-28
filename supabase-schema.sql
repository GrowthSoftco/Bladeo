-- ============================================================
-- BLADEO — Schema completo
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Barbershops (tenants)
CREATE TABLE IF NOT EXISTS barbershops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  cover_image_url TEXT,
  description TEXT,
  address TEXT,
  city TEXT DEFAULT 'Pereira',
  phone TEXT,
  whatsapp TEXT,
  instagram TEXT,
  opening_hours JSONB,
  payment_methods JSONB,
  payment_details JSONB,
  is_banking_correspondent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Members (users linked to a barbershop)
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'barber')) NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  commission_pct NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, barbershop_id)
);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  cost NUMERIC(10,2) DEFAULT 0,
  stock INT DEFAULT 0,
  sku TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  total_visits INT DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES members(id),
  client_id UUID REFERENCES clients(id),
  service_id UUID REFERENCES services(id),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')) DEFAULT 'pending',
  prepaid BOOLEAN DEFAULT false,
  prepaid_amount NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sales (POS transactions)
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES members(id),
  client_id UUID REFERENCES clients(id),
  appointment_id UUID REFERENCES appointments(id),
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sale line items
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('service', 'product')) NOT NULL,
  service_id UUID REFERENCES services(id),
  product_id UUID REFERENCES products(id),
  name TEXT NOT NULL,
  quantity INT DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL
);

-- Loyalty config
CREATE TABLE IF NOT EXISTS loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE UNIQUE,
  visits_required INT DEFAULT 10,
  reward_type TEXT CHECK (reward_type IN ('free_service', 'discount_pct', 'discount_fixed', 'custom')) DEFAULT 'free_service',
  reward_value NUMERIC(10,2),
  reward_description TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Loyalty stamps
CREATE TABLE IF NOT EXISTS loyalty_stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  current_stamps INT DEFAULT 0,
  total_redeemed INT DEFAULT 0,
  last_stamp_at TIMESTAMPTZ,
  UNIQUE(barbershop_id, client_id)
);

-- Remarketing rules
CREATE TABLE IF NOT EXISTS remarketing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_after_last_visit INT NOT NULL,
  message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Remarketing log
CREATE TABLE IF NOT EXISTS remarketing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES remarketing_rules(id),
  client_id UUID REFERENCES clients(id),
  barbershop_id UUID REFERENCES barbershops(id),
  scheduled_date DATE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Accounting reports
CREATE TABLE IF NOT EXISTS accounting_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  period_type TEXT CHECK (period_type IN ('biweekly', 'monthly')) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_income NUMERIC(10,2),
  total_expenses NUMERIC(10,2),
  net_profit NUMERIC(10,2),
  report_data JSONB,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- Subscriptions (Stripe)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  tier TEXT CHECK (tier IN ('basic', 'pro', 'elite')) NOT NULL DEFAULT 'basic',
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual')) NOT NULL DEFAULT 'monthly',
  status TEXT CHECK (status IN ('active', 'past_due', 'cancelled', 'unpaid', 'incomplete')) NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Banking correspondent transactions
CREATE TABLE IF NOT EXISTS banking_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  transaction_type TEXT CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'bill_payment', 'other')) NOT NULL,
  entity TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  commission_earned NUMERIC(10,2) DEFAULT 0,
  reference TEXT,
  client_name TEXT,
  client_document TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Gallery
CREATE TABLE IF NOT EXISTS gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES members(id),
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES members(id),
  client_id UUID REFERENCES clients(id),
  appointment_id UUID REFERENCES appointments(id),
  rating INT CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES members(id),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  preferred_date DATE,
  preferred_time_range TEXT CHECK (preferred_time_range IN ('morning', 'afternoon', 'evening')),
  status TEXT CHECK (status IN ('waiting', 'notified', 'booked', 'expired')) DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE barbershops ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE remarketing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE remarketing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Helper function: get barbershop_id for current user
CREATE OR REPLACE FUNCTION get_my_barbershop_id()
RETURNS UUID AS $$
  SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM members WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- BARBERSHOPS
CREATE POLICY "members_can_read_own_barbershop" ON barbershops
  FOR SELECT USING (id = get_my_barbershop_id());

CREATE POLICY "owners_can_update_barbershop" ON barbershops
  FOR UPDATE USING (id = get_my_barbershop_id() AND get_my_role() = 'owner');

-- MEMBERS
CREATE POLICY "members_can_read_own_team" ON members
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

CREATE POLICY "owners_can_manage_members" ON members
  FOR ALL USING (barbershop_id = get_my_barbershop_id() AND get_my_role() = 'owner');

-- SERVICES
CREATE POLICY "members_read_services" ON services
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

CREATE POLICY "owners_manage_services" ON services
  FOR ALL USING (barbershop_id = get_my_barbershop_id() AND get_my_role() = 'owner');

-- PRODUCTS
CREATE POLICY "members_read_products" ON products
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

CREATE POLICY "owners_manage_products" ON products
  FOR ALL USING (barbershop_id = get_my_barbershop_id() AND get_my_role() = 'owner');

-- CLIENTS
CREATE POLICY "members_read_clients" ON clients
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

CREATE POLICY "members_manage_clients" ON clients
  FOR ALL USING (barbershop_id = get_my_barbershop_id());

-- APPOINTMENTS
CREATE POLICY "members_read_appointments" ON appointments
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

CREATE POLICY "members_manage_appointments" ON appointments
  FOR ALL USING (barbershop_id = get_my_barbershop_id());

-- Public booking: allow insert without auth (via service role from API)
-- (handled server-side, no public RLS policy needed)

-- SALES
CREATE POLICY "members_read_sales" ON sales
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

CREATE POLICY "members_insert_sales" ON sales
  FOR INSERT WITH CHECK (barbershop_id = get_my_barbershop_id());

CREATE POLICY "owners_manage_sales" ON sales
  FOR ALL USING (barbershop_id = get_my_barbershop_id() AND get_my_role() = 'owner');

-- SALE ITEMS
CREATE POLICY "members_read_sale_items" ON sale_items
  FOR SELECT USING (
    sale_id IN (SELECT id FROM sales WHERE barbershop_id = get_my_barbershop_id())
  );

CREATE POLICY "members_insert_sale_items" ON sale_items
  FOR INSERT WITH CHECK (
    sale_id IN (SELECT id FROM sales WHERE barbershop_id = get_my_barbershop_id())
  );

-- LOYALTY
CREATE POLICY "members_read_loyalty_config" ON loyalty_config
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

CREATE POLICY "owners_manage_loyalty_config" ON loyalty_config
  FOR ALL USING (barbershop_id = get_my_barbershop_id() AND get_my_role() = 'owner');

CREATE POLICY "members_read_loyalty_stamps" ON loyalty_stamps
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

CREATE POLICY "members_manage_loyalty_stamps" ON loyalty_stamps
  FOR ALL USING (barbershop_id = get_my_barbershop_id());

-- REMARKETING
CREATE POLICY "owners_manage_remarketing" ON remarketing_rules
  FOR ALL USING (barbershop_id = get_my_barbershop_id() AND get_my_role() = 'owner');

CREATE POLICY "owners_read_remarketing_log" ON remarketing_log
  FOR SELECT USING (barbershop_id = get_my_barbershop_id() AND get_my_role() = 'owner');

-- EXPENSES
CREATE POLICY "owners_manage_expenses" ON expenses
  FOR ALL USING (barbershop_id = get_my_barbershop_id() AND get_my_role() = 'owner');

-- ACCOUNTING REPORTS
CREATE POLICY "owners_manage_reports" ON accounting_reports
  FOR ALL USING (barbershop_id = get_my_barbershop_id() AND get_my_role() = 'owner');

-- SUBSCRIPTIONS
CREATE POLICY "members_read_subscription" ON subscriptions
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

-- BANKING
CREATE POLICY "owners_manage_banking" ON banking_transactions
  FOR ALL USING (barbershop_id = get_my_barbershop_id() AND get_my_role() = 'owner');

-- GALLERY
CREATE POLICY "members_read_gallery" ON gallery
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

CREATE POLICY "members_manage_gallery" ON gallery
  FOR ALL USING (barbershop_id = get_my_barbershop_id());

-- REVIEWS
CREATE POLICY "members_read_reviews" ON reviews
  FOR SELECT USING (barbershop_id = get_my_barbershop_id());

-- WAITLIST
CREATE POLICY "members_manage_waitlist" ON waitlist
  FOR ALL USING (barbershop_id = get_my_barbershop_id());
