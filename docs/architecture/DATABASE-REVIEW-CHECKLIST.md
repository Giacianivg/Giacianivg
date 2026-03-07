# Database Design Review — Implementation Checklist

**Project:** Pousada Luz da Lua CRM Web + RMS
**Database:** Supabase PostgreSQL
**Review Date:** 2026-03-07
**Target Completion:** Phase 1 Week 3 (before production launch)

---

## Phase 1: CRM MVP (Weeks 1-3)

### Week 1: Foundation

- [ ] **Code Review**
  - [ ] Read full review: `DATABASE-DESIGN-REVIEW.md`
  - [ ] Review migration: `001_schema_initial.sql`
  - [ ] Understand atomic reservation pattern
  - [ ] Validate RLS policies

- [ ] **Schema Validation**
  - [ ] Confirm all 10 tables created in Supabase
  - [ ] Verify all indexes present: `pg_indexes`
  - [ ] Check RLS enabled on all tables
  - [ ] Validate triggers: `touch_updated_at`, `trg_leads_updated`, etc.

- [ ] **Seeding**
  - [ ] Run `initialize_calendar('2026-01-01', '2027-01-01')`
  - [ ] Verify 1460 rows in availability table (4 rooms × 365 days)
  - [ ] Check settings table has default values
  - [ ] Validate lead funnel enum values

### Week 2: Integration Testing

- [ ] **API Integration Tests**
  - [ ] Test `GET /api/leads` — verify index works
  - [ ] Test `GET /api/reservations` with date filters
  - [ ] Test `POST /api/leads` — validates phone format
  - [ ] Test `POST /reservations` via `create_reservation_atomic()` RPC
  - [ ] Test concurrent booking attempts (simulate race condition)

- [ ] **Data Validation**
  - [ ] Insert lead with invalid phone format → should fail
  - [ ] Insert reservation with checkout < checkin → should fail
  - [ ] Insert proposal with final_amount = 0 → should fail
  - [ ] Try to delete lead with reservations → should fail (FK RESTRICT)

- [ ] **RLS Testing**
  - [ ] Authenticated user can read all data ✅
  - [ ] Anonymous user cannot read any data ✅
  - [ ] Service role bypasses RLS ✅

### Week 3: Production Hardening

- [ ] **Apply Migration 002: Production Fixes**
  ```bash
  # Run in Supabase SQL Editor:
  # Copy contents of 002_phase1_production_fixes.sql
  # Execute
  ```
  - [ ] FK constraints made explicit (ON DELETE RESTRICT)
  - [ ] Composite indexes created:
    - [ ] `idx_reservations_active_occupancy` ← Dashboard perf
    - [ ] `idx_proposals_expiry` ← Cron perf
    - [ ] `idx_payments_pending` ← Follow-up perf
  - [ ] `auto_release_on_cancel()` trigger created
  - [ ] VACUUM tuning applied to conversations, ai_logs

- [ ] **Pagination Middleware**
  - [ ] Add pagination to `GET /api/leads` endpoint
    ```javascript
    // Default: limit=50, max=500
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;
    .range(offset, offset + limit - 1)
    ```
  - [ ] Test: `GET /api/leads?limit=20&offset=0` returns exactly 20 rows
  - [ ] Test: `GET /api/leads?limit=999` caps at 500 rows

  - [ ] Add pagination to `GET /api/conversations/:leadId`
  - [ ] Add pagination to `GET /api/proposals`
  - [ ] Add pagination to all list endpoints

- [ ] **Performance Testing**
  - [ ] Test with 1000+ leads in database
    - [ ] `GET /api/leads` <500ms ✅
    - [ ] `GET /api/reservations` <500ms ✅
    - [ ] Dashboard load <2s ✅
  - [ ] Load test: 5 concurrent users
    - [ ] No connection pool exhaustion
    - [ ] No "max_retries exceeded" errors
  - [ ] Enable `pg_stat_statements` to find slow queries
    ```sql
    CREATE EXTENSION pg_stat_statements;
    SELECT query, calls, mean_exec_time
    FROM pg_stat_statements
    WHERE mean_exec_time > 500
    ORDER BY mean_exec_time DESC LIMIT 10;
    ```

- [ ] **Race Condition Testing**
  - [ ] Simulate 2 users booking same room simultaneously
    - [ ] Expected: 1 succeeds, 1 gets "no_availability" error
    - [ ] Actual: ✅ Verify behavior matches
  - [ ] Simulate cancellation + immediate rebooking
    - [ ] Expected: New booking succeeds
    - [ ] Verify availability released correctly

- [ ] **Monitoring Setup**
  - [ ] Enable slow query logging (>1000ms threshold)
  - [ ] Configure Sentry error tracking
  - [ ] Setup Vercel Analytics dashboard
  - [ ] Create alert: "DB query > 5s"

### Week 3: Pre-Launch Validation

- [ ] **Data Integrity Checks**
  ```sql
  -- No orphaned records
  SELECT COUNT(*) FROM conversations WHERE lead_id NOT IN (SELECT id FROM leads WHERE deleted_at IS NULL);
  -- Should return 0

  -- Availability consistency
  SELECT COUNT(*) FROM availability WHERE status = 'reserved' AND reservation_id IS NULL;
  -- Should return 0

  -- Proposal-reservation linkage
  SELECT COUNT(*) FROM proposals WHERE status = 'accepted' AND reservation_id IS NULL;
  -- Should return 0
  ```

- [ ] **Backup Verification**
  - [ ] Confirm daily backups enabled in Supabase
  - [ ] Test restore procedure (in staging)
  - [ ] Verify point-in-time recovery window (7 days)

- [ ] **Documentation**
  - [ ] README updated with DB schema overview
  - [ ] API docs updated with all endpoints
  - [ ] Operator manual: "How to backup/restore"
  - [ ] Troubleshooting guide: "Common DB errors"

---

## Phase 2: RMS Foundation (Weeks 4-7)

### Phase 2 Week 1: RMS Data Structure

- [ ] **Apply Migration 003: RMS Tables**
  ```bash
  # Run in Supabase SQL Editor:
  # Copy contents of 003_phase2_rms_tables.sql
  # Execute
  ```

- [ ] **Verify New Tables Created**
  - [ ] `occupancy_history` table exists
  - [ ] `conversion_funnel_history` table exists
  - [ ] Indexes created on both
  - [ ] Views created:
    - [ ] `vw_occupancy_trends`
    - [ ] `vw_funnel_trends`
    - [ ] `vw_seasonality_analysis`
    - [ ] `vw_room_performance`

- [ ] **Test Helper Functions**
  ```sql
  -- Test occupancy population
  SELECT populate_occupancy_history(CURRENT_DATE);
  -- Should return 4 (one per room)

  -- Test funnel population
  SELECT populate_conversion_funnel(CURRENT_DATE);
  -- Should return true

  -- Verify data was inserted
  SELECT COUNT(*) FROM occupancy_history WHERE date = CURRENT_DATE;
  -- Should return 4
  ```

- [ ] **Setup Daily Cron (n8n)**
  - [ ] Create n8n workflow: "Daily Occupancy Snapshot"
    - [ ] Time: 23:59 UTC
    - [ ] Payload: `SELECT populate_occupancy_history(CURRENT_DATE);`
    - [ ] Error handling: Slack alert on failure

  - [ ] Create n8n workflow: "Daily Funnel Snapshot"
    - [ ] Time: 00:05 UTC (after occupancy cron)
    - [ ] Payload: `SELECT populate_conversion_funnel(CURRENT_DATE);`
    - [ ] Error handling: Slack alert on failure

  - [ ] Test crons: Run manually, verify data populated

### Phase 2 Week 2-3: Analytics Validation

- [ ] **View Output Validation**
  ```sql
  -- Occupancy trends should have data
  SELECT COUNT(*) FROM vw_occupancy_trends;

  -- Funnel trends should have data
  SELECT COUNT(*) FROM vw_funnel_trends;

  -- Seasonality should categorize correctly
  SELECT season, COUNT(*) FROM vw_seasonality_analysis GROUP BY season;
  ```

- [ ] **Data Aggregation Quality**
  - [ ] `occupancy_rate` between 0.00 and 1.00 ✅
  - [ ] `revenue_generated` >= 0 ✅
  - [ ] `conv_new_to_qualified` <= 100% ✅
  - [ ] No NULL values in critical fields
  - [ ] Timestamps are in correct timezone (UTC)

### Phase 2 Week 4: ML Preparation

- [ ] **Historical Data Backfill** (if migrating from existing system)
  ```sql
  -- Backfill last 2 years (for seasonality detection)
  DO $$
  DECLARE v_date DATE := '2024-03-07';
  BEGIN
    WHILE v_date <= CURRENT_DATE LOOP
      PERFORM populate_occupancy_history(v_date);
      PERFORM populate_conversion_funnel(v_date);
      v_date := v_date + INTERVAL '1 day';
    END LOOP;
  END;
  $$;
  ```

- [ ] **Dataset Validation for ML**
  - [ ] Minimum 90 days of historical data ✅
  - [ ] No missing dates (no gaps in occupancy_history)
  - [ ] All room types represented ✅
  - [ ] All seasons represented (if backfilling)
  - [ ] Revenue calculations correct (no anomalies)

---

## Phase 3: Future SaaS (Multi-Tenancy)

- [ ] **Multi-Tenancy Preparation**
  - [ ] Add `organization_id` UUID column to all tables
  - [ ] Create foreign key: `organization_id → organizations(id)`
  - [ ] Create organization table with users relationship
  - [ ] Update all RLS policies to include `organization_id` filter

- [ ] **RBAC Implementation** (Role-Based Access Control)
  - [ ] Add `role` column to users table (admin, receptionist, manager, analyst)
  - [ ] Update RLS policies by role:
    - [ ] admin: full access
    - [ ] receptionist: read leads/conversations, write notes only
    - [ ] manager: read all, write leads/reservations
    - [ ] analyst: read-only access

- [ ] **Audit Logging**
  - [ ] Create `audit_log` table
  - [ ] Add triggers to capture all INSERT/UPDATE/DELETE
  - [ ] Store: action, old_values, new_values, user_id, timestamp
  - [ ] Implement: GDPR right-to-be-forgotten (cascade delete audit logs)

---

## Ongoing Maintenance Checklist

### Weekly (Every Monday)

- [ ] Check Supabase dashboard for alerts
- [ ] Review slow query log (> 1s queries)
- [ ] Verify daily cron jobs ran successfully
- [ ] Check database size growth

### Monthly (1st of month)

- [ ] Analyze `pg_stat_statements` for optimization opportunities
- [ ] Review backup retention (maintain 12-month rolling window)
- [ ] Update documentation if schema changes made
- [ ] Test disaster recovery procedure in staging

### Quarterly (Every 3 months)

- [ ] Full database analysis: check index usage, bloat, fragmentation
- [ ] Performance baseline: compare query times to previous quarter
- [ ] Security audit: review RLS policies, check for access violations
- [ ] Capacity planning: estimate growth trajectory for next 12 months

---

## Rollback Procedures (If Migration Fails)

### If 002_phase1_production_fixes fails:

```sql
-- Revert FK constraints (remove explicit ON DELETE)
-- This is safe: default is still RESTRICT

ALTER TABLE reservations DROP CONSTRAINT fk_res_lead;
-- Don't recreate: implicit RESTRICT is fine

-- Drop new indexes (no impact on functionality)
DROP INDEX IF EXISTS idx_reservations_active_occupancy;
DROP INDEX IF EXISTS idx_proposals_expiry;
DROP INDEX IF EXISTS idx_payments_pending;

-- Drop trigger (fall back to manual release_reservation RPC)
DROP TRIGGER IF EXISTS trg_auto_release_cancelled ON reservations;
```

### If 003_phase2_rms_tables fails:

```sql
-- Drop new tables (clean removal, no data loss)
DROP TABLE IF EXISTS conversion_funnel_history CASCADE;
DROP TABLE IF EXISTS occupancy_history CASCADE;

-- Drop views
DROP VIEW IF EXISTS vw_occupancy_trends CASCADE;
DROP VIEW IF EXISTS vw_funnel_trends CASCADE;
DROP VIEW IF EXISTS vw_seasonality_analysis CASCADE;
DROP VIEW IF EXISTS vw_room_performance CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS populate_occupancy_history(DATE);
DROP FUNCTION IF EXISTS populate_conversion_funnel(DATE);
```

---

## Sign-Off

| Role | Name | Status | Date |
|------|------|--------|------|
| **Data Engineer** | Dara | ✅ Reviewed | 2026-03-07 |
| **Architect** | Aria | ⏳ Pending | __ / __ / __ |
| **DevOps** | Gage | ⏳ Pending | __ / __ / __ |
| **Product Manager** | Morgan | ⏳ Pending | __ / __ / __ |

---

## Related Documents

- [DATABASE-DESIGN-REVIEW.md](./DATABASE-DESIGN-REVIEW.md) — Full technical review
- [DATABASE-REVIEW-SUMMARY.md](./DATABASE-REVIEW-SUMMARY.md) — Executive summary
- Migration files:
  - [001_schema_initial.sql](../migrations/001_schema_initial.sql)
  - [002_phase1_production_fixes.sql](../migrations/002_phase1_production_fixes.sql)
  - [003_phase2_rms_tables.sql](../migrations/003_phase2_rms_tables.sql)

---

**Last Updated:** 2026-03-07
**Next Review:** Post-Phase 1 launch (Week 4)
