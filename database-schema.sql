-- Database Schema for Bladeo Barbershop Management System
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core Tables

-- Barbershop (tenant)
CREATE TABLE barbershops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- for public profile URL: /b/{slug}
  logo_url TEXT,
  cover_image_url TEXT,
  description TEXT,
  address TEXT,
  city TEXT DEFAULT 'Pereira',
  phone TEXT,
  whatsapp TEXT,
  instagram TEXT,
  opening_hours JSONB, -- { "mon": { "open": "08:00", "close": "20:00" }, ... }
  payment_methods JSONB, -- ["cash", "nequi", "daviplata", "bancolombia"]
  payment_details JSONB, -- { "nequi": "3001234567", "daviplata": "3001234567" }
  is_banking_correspondent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users/Members
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'barber')) NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  commission_pct NUMERIC(5,2) DEFAULT 0, -- e.g. 40.00 = 40%
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, barbershop_id)
);

-- Services offered
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Corte clásico", "Barba", "Corte + Barba"
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products for POS
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Shampoo X", "Cera para cabello"
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  cost NUMERIC(10,2) DEFAULT 0, -- costo para calcular ganancia
  stock INT DEFAULT 0,
  sku TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients
CREATE TABLE clients (
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
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES members(id),
  client_id UUID REFERENCES clients(id),
  service_id UUID REFERENCES services(id),
  client_name TEXT NOT NULL, -- in case client is not registered
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

-- POS Transactions (sales)
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES members(id),
  client_id UUID REFERENCES clients(id),
  appointment_id UUID REFERENCES appointments(id),
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL, -- "cash", "nequi", "daviplata", "card"
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sale line items
CREATE TABLE sale_items (
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

-- Loyalty / Fidelización
CREATE TABLE loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE UNIQUE,
  visits_required INT DEFAULT 10, -- visits for reward
  reward_type TEXT CHECK (reward_type IN ('free_service', 'discount_pct', 'discount_fixed', 'custom')) DEFAULT 'free_service',
  reward_value NUMERIC(10,2), -- e.g. 50.00 for 50% off or 20000 COP
  reward_description TEXT, -- "Corte gratis", "50% en tu siguiente corte"
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE loyalty_stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  current_stamps INT DEFAULT 0,
  total_redeemed INT DEFAULT 0,
  last_stamp_at TIMESTAMPTZ,
  UNIQUE(barbershop_id, client_id)
);

-- Remarketing campaigns (visual only, no actual WhatsApp integration yet)
CREATE TABLE remarketing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Recordatorio 15 días"
  days_after_last_visit INT NOT NULL, -- e.g. 15, 30, 60
  message_template TEXT NOT NULL, -- "Hola {client_name}, hace {days} días no te vemos..."
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE remarketing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES remarketing_rules(id),
  client_id UUID REFERENCES clients(id),
  barbershop_id UUID REFERENCES barbershops(id),
  scheduled_date DATE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses (for accounting)
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- "arriendo", "servicios", "productos", "nómina", "otros"
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Accounting reports (generated automatically)
CREATE TABLE accounting_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  period_type TEXT CHECK (period_type IN ('biweekly', 'monthly')) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_income NUMERIC(10,2),
  total_expenses NUMERIC(10,2),
  net_profit NUMERIC(10,2),
  report_data JSONB, -- detailed breakdown
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- Banking Correspondent (optional module)
CREATE TABLE banking_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  transaction_type TEXT CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'bill_payment', 'other')) NOT NULL,
  entity TEXT NOT NULL, -- "Efecty", "Bancolombia", "Nequi Punto", etc.
  amount NUMERIC(10,2) NOT NULL,
  commission_earned NUMERIC(10,2) DEFAULT 0,
  reference TEXT,
  client_name TEXT,
  client_document TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Barber portfolio / gallery
CREATE TABLE gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES members(id),
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Client reviews
CREATE TABLE reviews (
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
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES members(id), -- optional: specific barber preference
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  preferred_date DATE,
  preferred_time_range TEXT, -- "morning", "afternoon", "evening"
  status TEXT CHECK (status IN ('waiting', 'notified', 'booked', 'expired')) DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscriptions (for Stripe integration)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan_name TEXT NOT NULL, -- "basic", "pro", "elite"
  status TEXT CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')) NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies

-- Barbershops (public read for profiles, owner write)
ALTER TABLE barbershops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "barbershops_public_read" ON barbershops
  FOR SELECT USING (true);

CREATE POLICY "barbershops_owner_write" ON barbershops
  FOR ALL USING (
    id IN (
      SELECT barbershop_id FROM members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Members
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_tenant_read" ON members
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "members_owner_write" ON members
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_tenant_read" ON services
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "services_owner_write" ON services
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_tenant_read" ON products
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "products_owner_write" ON products
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_tenant_read" ON clients
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "clients_tenant_write" ON clients
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments_tenant_read" ON appointments
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "appointments_tenant_write" ON appointments
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_tenant_read" ON sales
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "sales_barber_insert" ON sales
  FOR INSERT WITH CHECK (
    barber_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "sales_owner_write" ON sales
  FOR UPDATE USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Sale Items
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_items_tenant_read" ON sale_items
  FOR SELECT USING (
    sale_id IN (
      SELECT id FROM sales WHERE barbershop_id IN (
        SELECT barbershop_id FROM members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "sale_items_tenant_write" ON sale_items
  FOR ALL USING (
    sale_id IN (
      SELECT id FROM sales WHERE barbershop_id IN (
        SELECT barbershop_id FROM members WHERE user_id = auth.uid()
      )
    )
  );

-- Loyalty Config
ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_config_tenant_read" ON loyalty_config
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "loyalty_config_owner_write" ON loyalty_config
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Loyalty Stamps
ALTER TABLE loyalty_stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_stamps_tenant_read" ON loyalty_stamps
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "loyalty_stamps_tenant_write" ON loyalty_stamps
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Remarketing Rules
ALTER TABLE remarketing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "remarketing_rules_tenant_read" ON remarketing_rules
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "remarketing_rules_owner_write" ON remarketing_rules
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Remarketing Log
ALTER TABLE remarketing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "remarketing_log_tenant_read" ON remarketing_log
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "remarketing_log_tenant_write" ON remarketing_log
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_tenant_read" ON expenses
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "expenses_owner_write" ON expenses
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Accounting Reports
ALTER TABLE accounting_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_reports_tenant_read" ON accounting_reports
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "accounting_reports_owner_write" ON accounting_reports
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Banking Transactions
ALTER TABLE banking_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banking_transactions_tenant_read" ON banking_transactions
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "banking_transactions_tenant_write" ON banking_transactions
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Gallery
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gallery_tenant_read" ON gallery
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "gallery_tenant_write" ON gallery
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_tenant_read" ON reviews
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "reviews_tenant_write" ON reviews
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Waitlist
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_tenant_read" ON waitlist
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "waitlist_tenant_write" ON waitlist
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

-- Subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_tenant_read" ON subscriptions
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "subscriptions_owner_write" ON subscriptions
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );