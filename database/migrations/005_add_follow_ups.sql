-- Migration: 005_add_follow_ups.sql
-- Create scheduled_follow_ups table for automated follow-up automation

CREATE TABLE IF NOT EXISTS scheduled_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  follow_up_type TEXT NOT NULL,
  -- 'quote_abandoned_1h', 'quote_abandoned_24h', 'quote_abandoned_72h'
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending', 'sent', 'cancelled', 'failed'
  template_name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sfu_pending
  ON scheduled_follow_ups(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sfu_lead
  ON scheduled_follow_ups(lead_id);

ALTER TABLE scheduled_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "sfu_authenticated_all"
  ON scheduled_follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);
