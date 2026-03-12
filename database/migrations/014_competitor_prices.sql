-- ============================================================
-- Migration 014: competitor_prices — Inteligência de Preços Regional
-- ============================================================
-- Armazena preços de pousadas concorrentes por data.
-- Populada pelo scraper Apify (cron 03h UTC diário) ou entrada manual.
-- NUNCA alterar migrations 001–013 existentes
-- ============================================================

CREATE TABLE IF NOT EXISTS competitor_prices (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_name text NOT NULL,
  competitor_url  text,
  platform        text DEFAULT 'booking'
    CHECK (platform IN ('booking', 'airbnb', 'direct')),
  date            date NOT NULL,
  price           numeric(10,2),
  room_type       text CHECK (room_type IN ('standard','casal','familia','grupo')),
  availability    boolean DEFAULT true,
  scraped_at      timestamptz DEFAULT now(),
  source          text DEFAULT 'apify'
    CHECK (source IN ('apify', 'manual'))
);

-- Índices para queries de calendário
CREATE INDEX IF NOT EXISTS idx_cp_date             ON competitor_prices(date);
CREATE INDEX IF NOT EXISTS idx_cp_competitor_date  ON competitor_prices(competitor_name, date);
CREATE INDEX IF NOT EXISTS idx_cp_platform         ON competitor_prices(platform);

COMMENT ON TABLE competitor_prices IS
  'Preços de pousadas concorrentes por data. Fonte: Apify (automático) ou entrada manual.';
COMMENT ON COLUMN competitor_prices.source IS
  'apify = scraping automático diário | manual = inserido pelo gestor';
COMMENT ON COLUMN competitor_prices.room_type IS
  'standard=1-2px | casal=2-3px | familia=4-6px | grupo=6-8px';
