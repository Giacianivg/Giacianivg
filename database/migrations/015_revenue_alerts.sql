-- ============================================================
-- Migration 015: revenue_alerts — Maxwell Revenue Intelligence
-- ============================================================
-- Armazena alertas gerados pelo @revenue-agent (Maxwell).
-- Diferente dos lead-alerts (colunas em leads), estes são
-- alertas de mercado/pricing inseridos como linhas independentes.
-- NUNCA alterar migrations 001–014 existentes
-- ============================================================

CREATE TABLE IF NOT EXISTS revenue_alerts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type   text NOT NULL
    CHECK (alert_type IN (
      'you_expensive', 'you_cheap_opportunity',
      'competitor_price_drop', 'competitor_price_surge',
      'high_demand_signal', 'low_season_warning'
    )),
  urgency      text DEFAULT 'medium'
    CHECK (urgency IN ('high', 'medium', 'low', 'info')),
  message      text NOT NULL,
  data         jsonb,           -- payload estruturado (preços, datas, etc)
  date_ref     date,            -- data a que o alerta se refere
  room_type    text,            -- tipo de quarto (ou null = todos)
  dismissed    boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ra_created_at  ON revenue_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ra_urgency     ON revenue_alerts(urgency) WHERE dismissed = false;
CREATE INDEX IF NOT EXISTS idx_ra_date_ref    ON revenue_alerts(date_ref);
CREATE INDEX IF NOT EXISTS idx_ra_dismissed   ON revenue_alerts(dismissed, created_at DESC);

COMMENT ON TABLE revenue_alerts IS
  'Alertas de revenue intelligence gerados por Maxwell (@revenue-agent). Leitura: GET /api/alerts/revenue.';
COMMENT ON COLUMN revenue_alerts.data IS
  'JSON estruturado: { our_price, avg_regional, diff_pct, competitor, prev_price, etc }';
