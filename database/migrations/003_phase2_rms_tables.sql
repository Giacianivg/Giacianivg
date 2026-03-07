-- =============================================================================
-- Migration: 003_phase2_rms_tables.sql
-- PLU-07.1: RMS Foundation — Historical Data Tables for Demand Forecasting
-- Author: @data-engineer | Reviewed by: @architect
-- Created: 2026-03-07
--
-- Purpose:
--   - Create occupancy_history table (daily occupancy metrics)
--   - Create conversion_funnel_history table (daily funnel KPIs)
--   - Create views for RMS analytics
--   - Prepare database for demand forecasting + pricing optimization
--
-- Deployment:
--   Execute in Supabase at Phase 2 Week 1
--   Before implementing ML demand forecast model
--
-- Risk: LOW — Purely additive, no schema changes to Phase 1 tables
-- Execution time: ~3 seconds
-- =============================================================================

-- =============================================================================
-- TABLE 1: OCCUPANCY_HISTORY
-- Purpose: Daily snapshot of occupancy metrics (for trend analysis + RMS)
-- Population: Daily cron job (n8n) at 23:59 UTC
-- Granularity: One row per (date, room_type)
-- Retention: Keep 2 years minimum (for seasonality detection)
-- =============================================================================

CREATE TABLE IF NOT EXISTS occupancy_history (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  DATE          NOT NULL,
  room_type             VARCHAR(20)   NOT NULL,

  -- Physical inventory
  total_units           SMALLINT      NOT NULL,
    -- ALA_A = 1, ALA_B = 1, ALA_C_1 = 1, ALA_C_2 = 1
    CHECK (total_units > 0),

  -- Occupancy data (calculated from availability + reservations)
  occupied_units        SMALLINT      NOT NULL DEFAULT 0,
    -- count of units with status = 'reserved'
    CHECK (occupied_units >= 0 AND occupied_units <= total_units),

  occupancy_rate        DECIMAL(3,2)  GENERATED ALWAYS AS (
    CASE
      WHEN total_units = 0 THEN NULL
      ELSE ROUND((occupied_units::DECIMAL / total_units), 2)
    END
  ) STORED,
    -- Computed: occupied / total (0.00 to 1.00)

  -- Revenue data
  price_charged         DECIMAL(10,2),
    -- Average nightly rate that day (for ADR calculation)

  revenue_generated     DECIMAL(12,2),
    -- Total revenue for the night (sum of all reservation amounts)
    CHECK (revenue_generated >= 0),

  -- Classification (for seasonality analysis)
  season                VARCHAR(20),
    CHECK (season IS NULL OR season IN ('baixa', 'media', 'alta', 'holiday')),
    -- baixa = low season (Feb, Apr-May, Aug-Oct)
    -- media = medium season (weekends outside holidays)
    -- alta = high season (Jun-Jul, Dec-early Jan)
    -- holiday = special events (Carnaval, Easter, EBAA, Xmas)

  day_of_week           VARCHAR(10),
    CHECK (day_of_week IS NULL OR day_of_week IN (
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    )),

  demand_indicator      VARCHAR(20)   DEFAULT 'normal',
    CHECK (demand_indicator IN ('low', 'normal', 'high', 'peak')),
    -- low = <50% occupancy
    -- normal = 50-75% occupancy
    -- high = 75-90% occupancy
    -- peak = >90% occupancy

  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW(),

  -- Constraints
  UNIQUE (date, room_type),
  CHECK (date <= CURRENT_DATE)  -- No future dates
);

-- Indexes for common RMS queries
CREATE INDEX IF NOT EXISTS idx_occupancy_date
  ON occupancy_history(date DESC);

CREATE INDEX IF NOT EXISTS idx_occupancy_room_date
  ON occupancy_history(room_type, date DESC);

CREATE INDEX IF NOT EXISTS idx_occupancy_season
  ON occupancy_history(season, date DESC);

CREATE INDEX IF NOT EXISTS idx_occupancy_demand
  ON occupancy_history(demand_indicator, date DESC);

-- Auto-update timestamp
DROP TRIGGER IF EXISTS trg_occupancy_updated ON occupancy_history;

CREATE TRIGGER trg_occupancy_updated
  BEFORE UPDATE ON occupancy_history
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RLS
ALTER TABLE occupancy_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "occupancy_authenticated_all"
  ON occupancy_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- TABLE 2: CONVERSION_FUNNEL_HISTORY
-- Purpose: Daily funnel KPIs (for conversion analysis + RMS)
-- Population: Daily cron job (n8n) at 00:05 UTC (after day closes)
-- Granularity: One row per date (aggregated across all leads)
-- Retention: Keep 2 years minimum (for historical baseline)
-- =============================================================================

CREATE TABLE IF NOT EXISTS conversion_funnel_history (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  DATE          NOT NULL UNIQUE,

  -- Funnel stage counts (snapshots of leads created/updated that day)
  leads_new             INT           DEFAULT 0,
    -- COUNT(*) WHERE funnel_stage = 'new' AND DATE(created_at) = date
    CHECK (leads_new >= 0),

  leads_qualified       INT           DEFAULT 0,
    -- COUNT(*) WHERE funnel_stage = 'qualified' AND DATE(updated_at) = date
    CHECK (leads_qualified >= 0),

  leads_proposal_sent   INT           DEFAULT 0,
    -- COUNT(*) WHERE EXISTS (proposal with status='sent' created that day)
    CHECK (leads_proposal_sent >= 0),

  leads_confirmed       INT           DEFAULT 0,
    -- COUNT(*) WHERE funnel_stage = 'confirmed' AND DATE(updated_at) = date
    CHECK (leads_confirmed >= 0),

  leads_lost            INT           DEFAULT 0,
    -- COUNT(*) WHERE funnel_stage = 'lost' AND DATE(updated_at) = date
    CHECK (leads_lost >= 0),

  -- Conversion rates (%)
  conv_new_to_qualified DECIMAL(5,2),
    -- new → qualified (e.g., 25.50 means 25.50%)
    CHECK (conv_new_to_qualified IS NULL OR (conv_new_to_qualified >= 0 AND conv_new_to_qualified <= 100)),

  conv_qualified_to_proposal DECIMAL(5,2),
    -- qualified → proposal_sent
    CHECK (conv_qualified_to_proposal IS NULL OR (conv_qualified_to_proposal >= 0 AND conv_qualified_to_proposal <= 100)),

  conv_proposal_to_confirmed DECIMAL(5,2),
    -- proposal_sent → confirmed
    CHECK (conv_proposal_to_confirmed IS NULL OR (conv_proposal_to_confirmed >= 0 AND conv_proposal_to_confirmed <= 100)),

  overall_conversion    DECIMAL(5,2),
    -- new → confirmed (end-to-end)
    CHECK (overall_conversion IS NULL OR (overall_conversion >= 0 AND overall_conversion <= 100)),

  -- Revenue summary
  revenue_day           DECIMAL(12,2) DEFAULT 0,
    -- SUM(total_amount) WHERE DATE(reservations.created_at) = date
    CHECK (revenue_day >= 0),

  avg_booking_value     DECIMAL(10,2),
    -- AVG(total_amount) of confirmed reservations that day
    CHECK (avg_booking_value IS NULL OR avg_booking_value >= 0),

  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW(),

  -- Constraints
  CHECK (date <= CURRENT_DATE)
);

-- Indexes for common RMS queries
CREATE INDEX IF NOT EXISTS idx_conv_date
  ON conversion_funnel_history(date DESC);

CREATE INDEX IF NOT EXISTS idx_conv_created
  ON conversion_funnel_history(created_at DESC);

-- Auto-update timestamp
DROP TRIGGER IF EXISTS trg_conv_updated ON conversion_funnel_history;

CREATE TRIGGER trg_conv_updated
  BEFORE UPDATE ON conversion_funnel_history
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RLS
ALTER TABLE conversion_funnel_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "conv_authenticated_all"
  ON conversion_funnel_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- VIEWS: RMS Analytics (Data aggregation for dashboards)
-- =============================================================================

-- View 1: Occupancy trends (by room type, over time)
CREATE OR REPLACE VIEW vw_occupancy_trends AS
SELECT
  date,
  room_type,
  occupancy_rate,
  price_charged,
  revenue_generated,
  season,
  demand_indicator,
  -- Rolling 7-day average occupancy
  AVG(occupancy_rate) OVER (
    PARTITION BY room_type
    ORDER BY date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as occupancy_rate_7d_avg
FROM occupancy_history
ORDER BY date DESC, room_type;

-- View 2: Funnel conversion over time
CREATE OR REPLACE VIEW vw_funnel_trends AS
SELECT
  date,
  leads_new,
  leads_qualified,
  leads_proposal_sent,
  leads_confirmed,
  leads_lost,
  overall_conversion,
  revenue_day,
  -- Rolling 7-day average conversion
  AVG(overall_conversion) OVER (
    ORDER BY date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as conversion_7d_avg,
  -- MoM comparison
  LAG(overall_conversion) OVER (ORDER BY date) as prior_day_conversion
FROM conversion_funnel_history
ORDER BY date DESC;

-- View 3: Seasonality analysis (aggregate by season)
CREATE OR REPLACE VIEW vw_seasonality_analysis AS
SELECT
  season,
  COUNT(*) as days_in_season,
  AVG(occupancy_rate) as avg_occupancy,
  MAX(occupancy_rate) as peak_occupancy,
  MIN(occupancy_rate) as low_occupancy,
  AVG(price_charged) as avg_price,
  SUM(revenue_generated) as total_revenue,
  AVG(revenue_generated) as avg_daily_revenue
FROM occupancy_history
WHERE season IS NOT NULL
GROUP BY season
ORDER BY avg_occupancy DESC;

-- View 4: Room type performance comparison
CREATE OR REPLACE VIEW vw_room_performance AS
SELECT
  room_type,
  COUNT(*) as days_tracked,
  AVG(occupancy_rate) as avg_occupancy,
  SUM(revenue_generated) as total_revenue,
  AVG(price_charged) as avg_nightly_rate,
  SUM(occupied_units) as total_nights_occupied,
  -- ADR (Average Daily Rate)
  ROUND(SUM(revenue_generated) / NULLIF(SUM(occupied_units), 0), 2) as adr,
  -- RevPAR (Revenue Per Available Room)
  ROUND(SUM(revenue_generated) / NULLIF(COUNT(*), 0), 2) as revpar
FROM occupancy_history
GROUP BY room_type
ORDER BY total_revenue DESC;

-- =============================================================================
-- HELPER FUNCTIONS for RMS Cron Jobs
-- =============================================================================

-- Function: Populate occupancy_history (called daily at 23:59 UTC)
CREATE OR REPLACE FUNCTION populate_occupancy_history(p_date DATE)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_count INT := 0;
  v_rooms TEXT[] := ARRAY['ALA_A', 'ALA_B', 'ALA_C_1', 'ALA_C_2'];
  v_room VARCHAR(20);
BEGIN
  FOREACH v_room IN ARRAY v_rooms LOOP
    INSERT INTO occupancy_history (
      date, room_type, total_units, occupied_units, price_charged, revenue_generated, season, day_of_week
    )
    SELECT
      p_date,
      v_room,
      1,  -- each room has 1 unit
      COUNT(CASE WHEN a.status = 'reserved' THEN 1 END),
      (SELECT AVG(r.total_amount / (r.checkout_date - r.checkin_date)::INT)
       FROM reservations r
       WHERE r.room_type = v_room AND r.checkin_date <= p_date AND p_date < r.checkout_date
         AND r.status IN ('confirmed', 'checked_in', 'completed')),
      (SELECT COALESCE(SUM(r.total_amount), 0)
       FROM reservations r
       WHERE r.room_type = v_room AND r.checkin_date <= p_date AND p_date < r.checkout_date
         AND r.status IN ('confirmed', 'checked_in', 'completed')),
      CASE
        WHEN EXTRACT(MONTH FROM p_date) IN (1, 12) THEN 'holiday'
        WHEN EXTRACT(MONTH FROM p_date) IN (6, 7) THEN 'alta'
        WHEN EXTRACT(MONTH FROM p_date) IN (2, 4, 5, 8, 9, 10) AND EXTRACT(DOW FROM p_date) NOT IN (0, 6)
          THEN 'baixa'
        WHEN EXTRACT(MONTH FROM p_date) IN (2, 4, 5, 8, 9, 10) AND EXTRACT(DOW FROM p_date) IN (0, 6)
          THEN 'media'
        ELSE 'media'
      END,
      to_char(p_date, 'Day')
    FROM availability a
    WHERE a.room_type = v_room AND a.date = p_date
    GROUP BY v_room
    ON CONFLICT (date, room_type) DO UPDATE SET
      occupied_units = EXCLUDED.occupied_units,
      price_charged = EXCLUDED.price_charged,
      revenue_generated = EXCLUDED.revenue_generated,
      updated_at = NOW();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Function: Populate conversion_funnel_history (called daily at 00:05 UTC)
CREATE OR REPLACE FUNCTION populate_conversion_funnel(p_date DATE)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_leads_new INT;
  v_leads_qualified INT;
  v_leads_proposal_sent INT;
  v_leads_confirmed INT;
  v_leads_lost INT;
  v_revenue_day DECIMAL(12,2);
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE DATE(l.created_at) = p_date AND l.funnel_stage = 'new'),
    COUNT(*) FILTER (WHERE l.funnel_stage = 'qualified' AND DATE(l.updated_at) = p_date),
    COUNT(*) FILTER (WHERE DATE(p.created_at) = p_date AND p.status = 'sent'),
    COUNT(*) FILTER (WHERE l.funnel_stage = 'confirmed' AND DATE(l.updated_at) = p_date),
    COUNT(*) FILTER (WHERE l.funnel_stage = 'lost' AND DATE(l.updated_at) = p_date),
    COALESCE(SUM(r.total_amount), 0)
  INTO
    v_leads_new, v_leads_qualified, v_leads_proposal_sent, v_leads_confirmed, v_leads_lost, v_revenue_day
  FROM leads l
  LEFT JOIN proposals p ON p.lead_id = l.id
  LEFT JOIN reservations r ON r.lead_id = l.id AND DATE(r.created_at) = p_date
    AND r.status IN ('confirmed', 'checked_in', 'completed');

  INSERT INTO conversion_funnel_history (
    date, leads_new, leads_qualified, leads_proposal_sent, leads_confirmed, leads_lost, revenue_day
  )
  VALUES (p_date, v_leads_new, v_leads_qualified, v_leads_proposal_sent, v_leads_confirmed, v_leads_lost, v_revenue_day)
  ON CONFLICT (date) DO UPDATE SET
    leads_new = EXCLUDED.leads_new,
    leads_qualified = EXCLUDED.leads_qualified,
    leads_proposal_sent = EXCLUDED.leads_proposal_sent,
    leads_confirmed = EXCLUDED.leads_confirmed,
    leads_lost = EXCLUDED.leads_lost,
    revenue_day = EXCLUDED.revenue_day,
    updated_at = NOW();

  RETURN TRUE;
END;
$$;

-- =============================================================================
-- SEED: Initialize with historical data (if migrating from existing system)
-- Note: Uncomment and run only if backfilling historical data
-- =============================================================================

-- -- Example: Backfill last 90 days
-- DO $$
-- DECLARE
--   v_date DATE := CURRENT_DATE - INTERVAL '90 days';
-- BEGIN
--   WHILE v_date <= CURRENT_DATE LOOP
--     PERFORM populate_occupancy_history(v_date);
--     PERFORM populate_conversion_funnel(v_date);
--     v_date := v_date + INTERVAL '1 day';
--   END LOOP;
-- END;
-- $$;

-- =============================================================================
-- VERIFICATION
-- Run these queries to verify tables and views are created
-- =============================================================================

-- -- Check table existence
-- SELECT tablename FROM pg_tables WHERE tablename IN ('occupancy_history', 'conversion_funnel_history');
--
-- -- Check view existence
-- SELECT viewname FROM pg_views WHERE viewname LIKE 'vw_%';
--
-- -- Check sample data (should be empty initially)
-- SELECT COUNT(*) FROM occupancy_history;
-- SELECT COUNT(*) FROM conversion_funnel_history;

-- =============================================================================
-- DOCUMENTATION
-- =============================================================================
--
-- USAGE IN PHASE 2:
--
-- 1. Daily Cron (n8n scheduler)
--    - 23:59 UTC: SELECT populate_occupancy_history(CURRENT_DATE);
--    - 00:05 UTC: SELECT populate_conversion_funnel(CURRENT_DATE);
--
-- 2. ML Inputs (for demand forecasting)
--    - SELECT * FROM occupancy_history WHERE date >= NOW() - INTERVAL '1 year'
--    - SELECT * FROM vw_seasonality_analysis;
--    - SELECT * FROM vw_room_performance;
--
-- 3. RMS Dashboard Queries
--    - SELECT * FROM vw_occupancy_trends WHERE date >= NOW() - INTERVAL '30 days';
--    - SELECT * FROM vw_funnel_trends WHERE date >= NOW() - INTERVAL '30 days';
--
-- 4. Pricing Optimizer Inputs
--    - SELECT occupancy_rate, price_charged FROM occupancy_history
--      WHERE season = 'alta' ORDER BY date DESC LIMIT 30;
--    - Use to detect: if occupancy > 85% → raise prices 10%
--
-- =============================================================================

-- =============================================================================
-- CHANGELOG
-- =============================================================================
-- [2026-03-07] Initial: RMS foundation tables
--   - Created occupancy_history (daily occupancy snapshots)
--   - Created conversion_funnel_history (daily funnel KPIs)
--   - Created RMS analytics views
--   - Added helper functions for cron population
-- =============================================================================
