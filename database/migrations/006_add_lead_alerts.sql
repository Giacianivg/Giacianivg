-- Migration: 006_add_lead_alerts.sql
-- Add alert columns to leads table

ALTER TABLE leads ADD COLUMN IF NOT EXISTS alert_type TEXT;
-- Valores: 'hot_lead', 'quote_expiring', 'checkin_soon', 'stalled', 'no_response', NULL

ALTER TABLE leads ADD COLUMN IF NOT EXISTS alert_message TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS alert_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_alert_type ON leads(alert_type) WHERE alert_type IS NOT NULL;
