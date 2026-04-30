-- ── Barber blocks: times/days barbers are unavailable ──────────────────────
CREATE TABLE IF NOT EXISTS barber_blocks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id  UUID REFERENCES barbershops(id) ON DELETE CASCADE NOT NULL,
  barber_id      UUID REFERENCES members(id)     ON DELETE CASCADE NOT NULL,
  date           DATE NOT NULL,
  start_time     TIME,          -- NULL means full-day block
  end_time       TIME,          -- NULL means full-day block
  reason         TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS barber_blocks_lookup
  ON barber_blocks(barbershop_id, barber_id, date);

ALTER TABLE barber_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_tenant_read" ON barber_blocks
  FOR SELECT USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "blocks_tenant_write" ON barber_blocks
  FOR ALL USING (
    barbershop_id IN (
      SELECT barbershop_id FROM members WHERE user_id = auth.uid() AND is_active = true
    )
  );
