-- ============================================================
-- Módulo de Anticipo de Liquidación — Bladeo
-- Corre este script en el SQL Editor de Supabase
-- ============================================================

-- 1. Tabla de anticipos
CREATE TABLE IF NOT EXISTS advances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  barber_id     UUID REFERENCES members(id)     ON DELETE CASCADE NOT NULL,
  amount        DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | paid
  notes         TEXT,
  requested_at  TIMESTAMPTZ DEFAULT now(),
  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES members(id),
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS advances_barbershop_idx ON advances(barbershop_id);
CREATE INDEX IF NOT EXISTS advances_barber_idx     ON advances(barber_id);
CREATE INDEX IF NOT EXISTS advances_status_idx     ON advances(status);

-- 2. Límites de anticipo en la barbería
ALTER TABLE barbershops
  ADD COLUMN IF NOT EXISTS advance_min DECIMAL(12,2) DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS advance_max DECIMAL(12,2) DEFAULT 500000;
