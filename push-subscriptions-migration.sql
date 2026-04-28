-- Run this in Supabase SQL Editor to enable Web Push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- Index for fast lookups when sending pushes to a barbershop
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_barbershop
  ON push_subscriptions (barbershop_id);

-- RLS: only service-role key can read/write (API uses admin client)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
