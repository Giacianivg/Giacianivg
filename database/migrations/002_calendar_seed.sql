-- =============================================================================
-- Migration: 002_calendar_seed.sql
-- PLU-06.1: Initialize availability calendar for 2026-2027
-- Author: @data-engineer
--
-- How to run:
--   Supabase Dashboard > SQL Editor > paste and execute AFTER 001_schema_initial.sql
--
-- Expected result: 4 rooms × 365 days = 1460 rows in availability table
-- =============================================================================

SELECT initialize_calendar('2026-01-01', '2027-01-01');

-- Verify
SELECT
  room_type,
  COUNT(*) AS total_days,
  MIN(date) AS first_date,
  MAX(date) AS last_date
FROM availability
GROUP BY room_type
ORDER BY room_type;
