-- =============================================================================
-- Migration: 002_phase1_production_fixes.sql
-- PLU-06.2: Critical Production Fixes + Phase 1 Hardening
-- Author: @data-engineer | Reviewed by: @architect
-- Created: 2026-03-07
--
-- Purpose:
--   - Make FK constraints explicit (ON DELETE RESTRICT)
--   - Add composite indexes for dashboard queries
--   - Auto-release cancelled reservations
--   - Tune VACUUM for high-churn tables
--
-- How to run:
--   Supabase Dashboard > SQL Editor > paste and execute
--   Safe to run: idempotent (IF NOT EXISTS pattern)
--
-- Risk: LOW — No breaking changes, backward compatible
-- Execution time: ~5 seconds
-- =============================================================================

-- =============================================================================
-- PHASE 1: Make FK Constraints Explicit
-- Reason: Currently implicit RESTRICT is confusing. Make it explicit for clarity.
-- =============================================================================

-- Issue: leads → reservations (prevent deletion of guest with history)
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS fk_res_lead;
ALTER TABLE reservations
  ADD CONSTRAINT fk_res_lead
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT;

-- Issue: leads → proposals (prevent deletion of guest with proposals)
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS fk_prop_lead;
ALTER TABLE proposals
  ADD CONSTRAINT fk_prop_lead
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT;

-- Issue: reservations → payments (prevent deletion of paid reservation)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_pay_reservation;
ALTER TABLE payments
  ADD CONSTRAINT fk_pay_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE RESTRICT;

-- =============================================================================
-- PHASE 2: Add Composite Indexes for Dashboard Queries
-- Reason: Dashboard queries need optimized multi-column indexes
-- =============================================================================

-- Dashboard: "Show me all checked_in reservations in next 7 days"
-- Query: SELECT * FROM reservations WHERE checkin_date <= NOW() + 7d AND checkout_date >= NOW()
CREATE INDEX IF NOT EXISTS idx_reservations_active_occupancy
  ON reservations(checkin_date, checkout_date)
  WHERE status IN ('confirmed', 'checked_in', 'completed');

-- Cron: Find expired proposals (older than 7 days)
-- Query: SELECT * FROM proposals WHERE status = 'sent' AND created_at < NOW() - 7d
CREATE INDEX IF NOT EXISTS idx_proposals_expiry
  ON proposals(status, created_at DESC)
  WHERE status IN ('sent', 'viewed');

-- Dashboard: "Show pending payments for follow-up"
-- Query: SELECT * FROM payments WHERE status = 'pending' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_payments_pending
  ON payments(created_at DESC)
  WHERE status IN ('pending', 'processing');

-- =============================================================================
-- PHASE 3: Auto-Release on Cancellation
-- Reason: Ensure availability dates are freed when reservation is cancelled
-- Trigger ensures: IF reservation.status = 'cancelled' THEN availability.status = 'available'
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_release_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only trigger on status change to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE availability
    SET
      status = 'available',
      reservation_id = NULL,
      block_reason = NULL,
      updated_at = NOW()
    WHERE reservation_id = NEW.id;

    -- Log the release (optional, for audit)
    -- INSERT INTO audit_log (action, ...) VALUES ('auto_release', ...);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists (safe idempotent)
DROP TRIGGER IF EXISTS trg_auto_release_cancelled ON reservations;

CREATE TRIGGER trg_auto_release_cancelled
  AFTER UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION auto_release_on_cancel();

-- =============================================================================
-- PHASE 4: Tune VACUUM for High-Churn Tables
-- Reason: conversations and ai_logs grow fast, need aggressive cleanup
-- Default autovacuum_vacuum_scale_factor = 0.1 (10% bloat)
-- We lower to 0.02 (2% bloat) for fast-growing tables
-- =============================================================================

-- conversations: ~100-200 rows/day → 3K-6K/month
ALTER TABLE conversations SET (autovacuum_vacuum_scale_factor = 0.02);

-- ai_logs: ~150-200 rows/day → 4.5K-6K/month (largest growth)
ALTER TABLE ai_logs SET (autovacuum_vacuum_scale_factor = 0.02);

-- followups: ~30 rows/day → 900/month
ALTER TABLE followups SET (autovacuum_vacuum_scale_factor = 0.05);

-- payments: ~10 rows/day → 300/month (slower)
-- Keep default (0.1)

-- =============================================================================
-- PHASE 5: Enable Query Logging (Optional, for monitoring)
-- Note: Uncomment if you want to track slow queries
-- Warning: Can impact performance in high-volume systems
-- =============================================================================

-- -- Monitor slow queries (>1000ms)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
--
-- -- View slow queries:
-- -- SELECT query, calls, mean_exec_time FROM pg_stat_statements
-- -- WHERE mean_exec_time > 1000 ORDER BY mean_exec_time DESC LIMIT 20;

-- =============================================================================
-- VERIFICATION
-- Run these queries to verify fixes were applied
-- =============================================================================

-- Verify FK constraints are explicit
-- SELECT constraint_name, constraint_type, table_name
-- FROM information_schema.table_constraints
-- WHERE table_name IN ('reservations', 'proposals', 'payments')
-- AND constraint_type = 'FOREIGN KEY';

-- Verify indexes were created
-- SELECT indexname FROM pg_indexes
-- WHERE indexname LIKE 'idx_reservations_active_%'
--    OR indexname LIKE 'idx_proposals_expiry%'
--    OR indexname LIKE 'idx_payments_pending%';

-- Verify trigger is in place
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name = 'trg_auto_release_cancelled';

-- =============================================================================
-- CHANGELOG
-- =============================================================================
-- [2026-03-07] Initial: Production hardening for Phase 1
--   - Made FK constraints explicit
--   - Added composite indexes
--   - Added auto-release trigger
--   - Tuned VACUUM settings
-- =============================================================================
