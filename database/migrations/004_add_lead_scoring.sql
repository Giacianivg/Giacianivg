-- Migration: 004_add_lead_scoring.sql
-- Add scoring columns to leads table

ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_label TEXT DEFAULT 'cold';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
