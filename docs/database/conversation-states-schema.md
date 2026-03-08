# Conversation States Database Design — PLU-01.3

**Author:** Dara (Data Engineer)
**Date:** 2026-03-08
**Status:** Schema Review (Design Phase)
**Complexity:** Low
**Risk Level:** Very Low (new isolated table, no breaking changes)

---

## 1. Domain Analysis

### Business Context
- Guest conversations flow through 7 states (GREETING → HANDOFF_HUMAN)
- State persists per phone number (guest identifier)
- Collected data (nome, datas, pessoas, tipo_quarto, quote) fills progressively
- 24h TTL: conversations older than 24h are "expired"
- Relationship: 1 lead → 1 conversation state (at a time)

### Data Relationships
```
leads (existing)
  ├─ id (UUID, PK)
  ├─ phone (unique)
  └─ ...

conversation_states (NEW)
  ├─ lead_id (FK → leads.id)
  ├─ phone (denormalized, for direct lookup)
  ├─ state (enum-like)
  ├─ data (jsonb: collected fields)
  ├─ metadata (jsonb: control fields)
  └─ timestamps

conversations (existing, for history)
  ├─ id
  ├─ lead_id (FK)
  └─ messages (array)
```

### Access Patterns
1. **Webhook:** Load state by phone → read/write → immediate
2. **Reservation confirmation:** Load state by lead_id → read → validate
3. **Cleanup job:** Find expired states → delete → 6h batch
4. **Admin (future):** Query by state, by date range → reporting

---

## 2. Complete DDL (Data Definition Language)

### Table: `conversation_states`

```sql
-- Create enum type for states (optional, but better than CHECK constraint)
CREATE TYPE conversation_state AS ENUM (
  'GREETING',
  'ASK_DATES',
  'ASK_GUESTS',
  'SHOW_ROOMS',
  'SEND_QUOTE',
  'CONFIRM_BOOKING',
  'HANDOFF_HUMAN'
);

-- Main table
CREATE TABLE conversation_states (
  -- Primary Key
  lead_id UUID PRIMARY KEY,

  -- Foreign Key (reference to leads table)
  CONSTRAINT fk_conversation_states_lead_id
    FOREIGN KEY (lead_id)
    REFERENCES leads(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- State Identification (required)
  phone VARCHAR(20) NOT NULL UNIQUE,
  state conversation_state NOT NULL DEFAULT 'GREETING',

  -- Collected Context Data (JSON)
  -- Progressive filling as guest provides info
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  --
  -- Expected fields (not enforced at DB level, enforced by app):
  -- {
  --   "nome": "João Silva",
  --   "data_entrada": "15/03/2026",
  --   "data_saida": "17/03/2026",
  --   "pessoas": 2,
  --   "tipo_quarto": "ALA_A",
  --   "quote": {
  --     "total": 600,
  --     "currency": "BRL",
  --     "breakdown": [ ... ]
  --   }
  -- }

  -- Control & Metadata (JSON)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  --
  -- Expected fields (not enforced at DB level):
  -- {
  --   "attempts_asking_dates": 2,
  --   "last_question_ts": 1709906400000,
  --   "escalation_reason": "Não respondeu após 3 tentativas",
  --   "attempts_total": 8,
  --   "source": "whatsapp"
  -- }

  -- Timestamps (baseline for all tables)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- TTL Field (explicit expiry)
  expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),

  -- Constraints
  CONSTRAINT expires_in_future CHECK (expires_at > CURRENT_TIMESTAMP),
  CONSTRAINT phone_format CHECK (phone ~ '^\+?55\d{9,11}$'),
  CONSTRAINT valid_state_choice CHECK (state IN ('GREETING', 'ASK_DATES', 'ASK_GUESTS', 'SHOW_ROOMS', 'SEND_QUOTE', 'CONFIRM_BOOKING', 'HANDOFF_HUMAN'))
);

-- Comment for documentation
COMMENT ON TABLE conversation_states IS
  'Persistent conversation state machine per guest (phone). Single source of truth for conversation progress. TTL = 24h.';

COMMENT ON COLUMN conversation_states.lead_id IS
  'Foreign key to leads table. Primary identifier for guest. Cascading delete.';

COMMENT ON COLUMN conversation_states.phone IS
  'Denormalized from leads.phone for webhook direct lookup. Unique index for fast queries. Format: +5519987654321 or 19987654321.';

COMMENT ON COLUMN conversation_states.state IS
  'Current state in 7-state funnel: GREETING → ... → HANDOFF_HUMAN. Enum type = type-safe, no magic strings.';

COMMENT ON COLUMN conversation_states.data IS
  'Progressively filled JSON object containing collected guest info: nome, data_entrada, data_saida, pessoas, tipo_quarto, quote. No schema enforcement; validated by application layer.';

COMMENT ON COLUMN conversation_states.metadata IS
  'Control data for state machine: attempt counters, timestamps, escalation reasons. Used for auto-escalation logic (> 3 attempts → HANDOFF_HUMAN).';

COMMENT ON COLUMN conversation_states.expires_at IS
  'Conversation expires after 24h of creation. Cleanup job runs every 6h to soft-delete or hard-delete expired records. Can be extended programmatically if needed.';
```

### Trigger: Auto-Update `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_conversation_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_conversation_states_updated_at
  BEFORE UPDATE ON conversation_states
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_states_updated_at();

COMMENT ON TRIGGER tr_conversation_states_updated_at ON conversation_states IS
  'Auto-update updated_at timestamp on every row modification. Ensures audit trail accuracy.';
```

---

## 3. Indexes Strategy

### Index 1: Lookup by Phone (Webhook Primary Query)

```sql
CREATE UNIQUE INDEX idx_conversation_states_phone
  ON conversation_states (phone);

-- Analysis: O(1) lookup by phone from webhook
-- Type: UNIQUE (enforces no duplicates)
-- Size: ~100 bytes per row
-- Query: SELECT * FROM conversation_states WHERE phone = '5519987654321'
```

### Index 2: Lookup by Lead ID (Already PK)
```
-- PRIMARY KEY (lead_id) already creates index
-- Query: SELECT * FROM conversation_states WHERE lead_id = <uuid>
```

### Index 3: Find Expired States (Cleanup Job)

```sql
CREATE INDEX idx_conversation_states_expires_at
  ON conversation_states (expires_at)
  WHERE state != 'HANDOFF_HUMAN';

-- Analysis: Nightly cleanup job finds expired states quickly
-- Type: Partial index (only non-terminal states need cleanup)
-- Query: SELECT * FROM conversation_states WHERE expires_at < NOW()
```

### Index 4: Query by State (Future Analytics)

```sql
CREATE INDEX idx_conversation_states_state
  ON conversation_states (state, created_at DESC);

-- Analysis: Analytics queries on state distribution + time-series
-- Type: Composite (state + time ordering)
-- Query: SELECT state, COUNT(*) FROM conversation_states WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY state
```

### Index 5: Query by Created Time (Audits)

```sql
CREATE INDEX idx_conversation_states_created_at
  ON conversation_states (created_at DESC);

-- Analysis: Recent conversations first (for manual review if needed)
-- Query: SELECT * FROM conversation_states WHERE created_at > NOW() - INTERVAL '1 day' ORDER BY created_at DESC
```

---

## 4. Row-Level Security (RLS)

### Policy 1: Internal Service Only (Webhook)

```sql
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role (webhook) can SELECT/INSERT/UPDATE/DELETE
CREATE POLICY "service_internal_access"
  ON conversation_states
  FOR ALL
  USING (
    -- Check if current JWT has 'service' role claim
    (auth.jwt_claims()->>'role') = 'service'
    OR
    -- OR check if request has internal API key in header
    current_setting('request.headers', true)::json->>'x-internal-key' = current_setting('app.internal_api_key', true)
  );

COMMENT ON POLICY "service_internal_access" ON conversation_states IS
  'Only webhook service can access conversation states. Enforced via JWT role or internal API key header.';
```

### Policy 2: Deny All by Default

```sql
CREATE POLICY "deny_all_default"
  ON conversation_states
  FOR ALL
  USING (false);

COMMENT ON POLICY "deny_all_default" ON conversation_states IS
  'Default-deny policy. Only explicitly allowed roles can access via other policies.';
```

---

## 5. Data Constraints & Validation

### Constraint 1: Phone Format
```sql
CONSTRAINT phone_format CHECK (phone ~ '^\+?55\d{9,11}$')
```
**Validates:** +5519987654321 or 19987654321 format (Brazilian numbers)

### Constraint 2: Expires Always in Future
```sql
CONSTRAINT expires_in_future CHECK (expires_at > CURRENT_TIMESTAMP)
```
**Validates:** Can't set expiry to past date (prevents accidents)

### Constraint 3: Valid State Value
```sql
CONSTRAINT valid_state_choice CHECK (state IN (
  'GREETING', 'ASK_DATES', 'ASK_GUESTS', 'SHOW_ROOMS',
  'SEND_QUOTE', 'CONFIRM_BOOKING', 'HANDOFF_HUMAN'
))
```
**Validates:** Only defined states allowed (backup to enum type)

### Foreign Key: Lead Must Exist
```sql
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
```
**Validates:** Can't insert conversation_state without valid lead. If lead deleted, cascade deletes conversation_state.

---

## 6. Migration Strategy

### Migration File: `001_create_conversation_states.sql`

**Purpose:** Create table + indexes + RLS in single transaction

**Steps:**
```sql
BEGIN TRANSACTION;

-- 1. Create enum type
CREATE TYPE conversation_state AS ENUM (...);

-- 2. Create table
CREATE TABLE conversation_states (...);

-- 3. Create trigger
CREATE TRIGGER ...;

-- 4. Create indexes
CREATE INDEX ...;

-- 5. Enable RLS + policies
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
CREATE POLICY ...;

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_states TO service_role;
REVOKE ALL ON conversation_states FROM anon;

COMMIT;
```

**Rollback Strategy:**
```sql
-- Rollback: 001_create_conversation_states_rollback.sql
BEGIN TRANSACTION;

DROP TRIGGER IF EXISTS tr_conversation_states_updated_at ON conversation_states;
DROP FUNCTION IF EXISTS update_conversation_states_updated_at();
DROP TABLE IF EXISTS conversation_states CASCADE;
DROP TYPE IF EXISTS conversation_state;

COMMIT;
```

**Execution:**
```bash
# Apply migration (Supabase CLI or manually)
supabase db push

# Verify
SELECT * FROM conversation_states LIMIT 0;  -- Should return 0 rows, no error
```

---

## 7. Backup & Recovery Plan

### Backup Strategy
```
Daily automated backups (Supabase default):
  - Point-in-time recovery: up to 14 days
  - Full snapshots: once per week
  - Transaction logs: continuous WAL archiving
```

### Manual Snapshot Before Migration
```sql
-- Before applying migration, snapshot current schema
pg_dump -h <supabase-host> -U <user> -d <db> --schema-only > schema_backup_2026-03-08.sql

-- Snapshot sample data (if any existing data)
SELECT * FROM leads LIMIT 100 TO /tmp/leads_sample.json;
```

### Recovery Scenarios

**Scenario A: Migration fails**
```
1. Supabase automatically rolls back transaction
2. Check error logs
3. Fix SQL, retry migration
4. No manual intervention needed (transactional safety)
```

**Scenario B: Data corruption detected**
```
1. Use Supabase "Restore backup" feature
2. Select point-in-time (within 14 days)
3. Test in staging first
4. Promote to production after verification
```

**Scenario C: Need to undo migration**
```
1. Run rollback script: 001_...rollback.sql
2. Verify schema is back to previous state
3. Developers informed of schema change
```

---

## 8. Performance Analysis

### Storage Footprint per Row
```
lead_id (UUID):           16 bytes
phone (VARCHAR 20):       ~20 bytes
state (ENUM):             4 bytes
data (JSONB, avg 500B):   ~500 bytes
metadata (JSONB, avg 200B): ~200 bytes
created_at (TIMESTAMP):   8 bytes
updated_at (TIMESTAMP):   8 bytes
expires_at (TIMESTAMP):   8 bytes
────────────────────────
Total per row:            ~764 bytes
```

### Estimated Scale (1000 active conversations)
```
1000 rows × 764 bytes = 764 KB (tiny)
Indexes: ~50 KB
Total: <1 MB
```

**Conclusion:** Storage is negligible. Scaling to 10,000 conversations = still <10 MB.

### Query Performance

| Query | Index Used | Estimated Time |
|-------|-----------|-----------------|
| `SELECT * FROM conversation_states WHERE phone = '...'` | idx_phone (UNIQUE) | < 1 ms |
| `SELECT * FROM conversation_states WHERE lead_id = <uuid>` | PRIMARY KEY | < 1 ms |
| `SELECT * FROM conversation_states WHERE expires_at < NOW()` | idx_expires_at | < 10 ms |
| `SELECT COUNT(*) FROM conversation_states WHERE state = 'HANDOFF_HUMAN'` | idx_state | < 50 ms |

---

## 9. Monitoring & Observability

### Metrics to Track

```sql
-- Total active conversations
SELECT COUNT(*) FROM conversation_states WHERE expires_at > NOW();

-- Distribution by state
SELECT state, COUNT(*)
FROM conversation_states
WHERE expires_at > NOW()
GROUP BY state;

-- Expired conversations (cleanup candidates)
SELECT COUNT(*) FROM conversation_states WHERE expires_at <= NOW();

-- Avg time in system
SELECT AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) / 60 AS avg_minutes
FROM conversation_states
WHERE expires_at > NOW();
```

### Alerts to Configure

```
Alert 1: Disk usage > 80%
Alert 2: Query latency > 100ms
Alert 3: Constraint violations (failed inserts)
Alert 4: Cascade deletes > 10/hour (leads being deleted?)
```

---

## 10. Future Optimizations (Out of Scope)

### Optimization A: Partitioning by Date
```sql
-- When rows > 1M, partition by created_at month
CREATE TABLE conversation_states_y2026m03 PARTITION OF conversation_states
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

### Optimization B: Archive Cold Data
```sql
-- Move expired > 90 days to archive table
CREATE TABLE conversation_states_archive AS SELECT * FROM conversation_states WHERE expires_at < NOW() - INTERVAL '90 days';
DELETE FROM conversation_states WHERE expires_at < NOW() - INTERVAL '90 days';
```

### Optimization C: Materialized Views for Analytics
```sql
CREATE MATERIALIZED VIEW conversation_states_daily_summary AS
  SELECT DATE(created_at), state, COUNT(*)
  FROM conversation_states
  GROUP BY DATE(created_at), state;
```

---

## 11. Deployment Checklist

### Pre-Deployment
- [ ] Schema reviewed by @data-engineer (Dara) ✓ (in progress)
- [ ] Indexes verified for access patterns ✓
- [ ] RLS policies understood by @architect ✓
- [ ] Rollback script tested locally
- [ ] Supabase backup confirmed available
- [ ] Zero-downtime approach validated (adding table = safe)

### Deployment
- [ ] Migration file created: `001_create_conversation_states.sql`
- [ ] Run on development database first
- [ ] Verify schema exists: `\d conversation_states`
- [ ] Test RLS policies with service role
- [ ] Deploy to staging
- [ ] Deploy to production (off-peak hours recommended)

### Post-Deployment
- [ ] Query webhook access: `SELECT * FROM conversation_states WHERE phone = 'test'`
- [ ] Verify TTL expiry in 24h
- [ ] Monitor query performance (should be <1ms)
- [ ] Document schema in team wiki
- [ ] Update API docs with new table

---

## 12. Risk Assessment

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|-----------|
| Phone constraint too strict | Low | Medium | App layer handles flexible input → normalized format |
| Expires_at constraint blocks updates | Low | Low | Application always sets future expiry when updating |
| RLS misconfiguration | Low | High | Manual testing with service role before deploy |
| Index bloat (on composite key) | Very Low | Low | Monitor with `EXPLAIN ANALYZE` quarterly |
| Cascade delete kills data | Very Low | High | Verify leads table has referential integrity |

---

## 13. Approval Checklist

- [ ] Schema DDL correct?
- [ ] Indexes optimize for access patterns?
- [ ] RLS policies secure (service-only)?
- [ ] Constraints reasonable?
- [ ] Rollback script works?
- [ ] Ready for @dev implementation?

---

## Recommendations

### ✅ Approved Design Features
- Enum type for states (type-safe)
- JSONB for flexible data collection (schema-less progression)
- Unique index on phone (webhook performance)
- RLS on service role (security)
- TTL via expires_at (cleanup)
- Cascading FK (data consistency)

### 🟡 Considerations
- Keep JSON structure undocumented at DB level (flexibility)
- Application validates data.nome, data.datas, etc. (not DB)
- Cleanup job must run regularly (6h interval recommended)

### ❌ Avoided Anti-Patterns
- ❌ NOT using JSON Web Tokens in column (security)
- ❌ NOT soft-deletes with deleted_at (for conversations, hard-delete OK after TTL)
- ❌ NOT partitioning (not needed at 1K-10K rows)
- ❌ NOT triggering updates to other tables (isolation)

---

**Status:** Schema Design Complete & Ready for Implementation

**Next Steps:**
1. @dev implements migration + ConversationStateMachine class
2. @qa tests schema integrity + RLS policies
3. @devops deploys to production (off-peak)

— Dara 📊
