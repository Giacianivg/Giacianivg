-- Migration: Create conversation_states table with state machine support
-- Author: Dex (Dev)
-- Date: 2026-03-08
-- Purpose: Persistent conversation state per guest phone number
-- Status: Ready for Supabase deployment

BEGIN TRANSACTION;

-- Step 1: Create enum type for states (type-safe)
CREATE TYPE conversation_state AS ENUM (
  'GREETING',
  'ASK_DATES',
  'ASK_GUESTS',
  'SHOW_ROOMS',
  'SEND_QUOTE',
  'CONFIRM_BOOKING',
  'HANDOFF_HUMAN'
);

-- Step 2: Create main table
CREATE TABLE conversation_states (
  -- Primary Key (linked to leads table)
  lead_id UUID PRIMARY KEY,

  -- Foreign Key constraint
  CONSTRAINT fk_conversation_states_lead_id
    FOREIGN KEY (lead_id)
    REFERENCES leads(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- State Identification
  phone VARCHAR(20) NOT NULL UNIQUE,
  state conversation_state NOT NULL DEFAULT 'GREETING',

  -- Collected Context Data (progressive filling)
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Expected structure (not enforced at DB level):
  -- {
  --   "nome": "João Silva",
  --   "data_entrada": "15/03/2026",
  --   "data_saida": "17/03/2026",
  --   "pessoas": 2,
  --   "tipo_quarto": "ALA_A",
  --   "quote": { "total": 600, "currency": "BRL", ... }
  -- }

  -- Control & Metadata (for state machine logic)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Expected structure (not enforced at DB level):
  -- {
  --   "attempts_asking_dates": 2,
  --   "last_question_ts": 1709906400000,
  --   "escalation_reason": "Não respondeu após 3 tentativas",
  --   "attempts_total": 8,
  --   "source": "whatsapp"
  -- }

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),

  -- Data Constraints
  CONSTRAINT expires_in_future CHECK (expires_at > CURRENT_TIMESTAMP),
  CONSTRAINT phone_format CHECK (phone ~ '^\+?55\d{9,11}$' OR phone ~ '^\d{10,11}$'),
  CONSTRAINT valid_state_choice CHECK (state IN ('GREETING', 'ASK_DATES', 'ASK_GUESTS', 'SHOW_ROOMS', 'SEND_QUOTE', 'CONFIRM_BOOKING', 'HANDOFF_HUMAN'))
);

-- Step 3: Add table documentation
COMMENT ON TABLE conversation_states IS
  'Persistent conversation state machine per guest (phone). Single source of truth for conversation progress. TTL = 24h. Enables deterministic 7-state funnel control.';

COMMENT ON COLUMN conversation_states.lead_id IS
  'Foreign key to leads table. Primary identifier for guest. Cascading delete if lead is removed.';

COMMENT ON COLUMN conversation_states.phone IS
  'Denormalized from leads.phone for webhook direct lookup. Unique index for fast queries. Format: +5519987654321 or 19987654321.';

COMMENT ON COLUMN conversation_states.state IS
  'Current state in 7-state funnel: GREETING → ASK_DATES → ASK_GUESTS → SHOW_ROOMS → SEND_QUOTE → CONFIRM_BOOKING → HANDOFF_HUMAN. Enum type = type-safe.';

COMMENT ON COLUMN conversation_states.data IS
  'Progressively filled JSON object containing collected guest info: nome, data_entrada, data_saida, pessoas, tipo_quarto, quote. No schema enforcement; validated by application layer.';

COMMENT ON COLUMN conversation_states.metadata IS
  'Control data for state machine: attempt counters, timestamps, escalation reasons. Used for auto-escalation logic (> 3 attempts → HANDOFF_HUMAN).';

COMMENT ON COLUMN conversation_states.expires_at IS
  'Conversation expires after 24h of creation. Cleanup job runs every 6h to delete expired records.';

-- Step 4: Create trigger for auto-update of updated_at
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

-- Step 5: Create indexes for common query patterns
-- Index 1: Webhook primary lookup (by phone)
CREATE UNIQUE INDEX idx_conversation_states_phone
  ON conversation_states (phone);

COMMENT ON INDEX idx_conversation_states_phone IS
  'Webhook queries: SELECT * FROM conversation_states WHERE phone = ''...''  (O(1) lookup)';

-- Index 2: Find expired states (cleanup job)
CREATE INDEX idx_conversation_states_expires_at
  ON conversation_states (expires_at)
  WHERE state != 'HANDOFF_HUMAN';

COMMENT ON INDEX idx_conversation_states_expires_at IS
  'Cleanup job queries: SELECT * FROM conversation_states WHERE expires_at < NOW() (partial index, excludes terminal state)';

-- Index 3: Query by state (future analytics)
CREATE INDEX idx_conversation_states_state
  ON conversation_states (state, created_at DESC);

COMMENT ON INDEX idx_conversation_states_state IS
  'Analytics queries on state distribution: SELECT state, COUNT(*) ... GROUP BY state';

-- Index 4: Query by created_at (audits & recent conversations)
CREATE INDEX idx_conversation_states_created_at
  ON conversation_states (created_at DESC);

COMMENT ON INDEX idx_conversation_states_created_at IS
  'Recent conversations: SELECT * FROM conversation_states WHERE created_at > NOW() - INTERVAL ''1 day'' ORDER BY created_at DESC';

-- Step 6: Enable Row-Level Security
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role only (webhook)
CREATE POLICY "service_internal_access"
  ON conversation_states
  FOR ALL
  USING (
    -- Check if current JWT has 'service' role claim
    (auth.jwt_claims() ->> 'role') = 'service'
  );

COMMENT ON POLICY "service_internal_access" ON conversation_states IS
  'Only webhook service (with service role JWT) can access conversation states. Enforces security boundary.';

-- RLS Policy: Deny all by default
CREATE POLICY "deny_all_default"
  ON conversation_states
  FOR ALL
  USING (false);

COMMENT ON POLICY "deny_all_default" ON conversation_states IS
  'Default-deny policy. Only explicitly allowed roles can access via other policies.';

-- Step 7: Grant permissions to service role
GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_states TO service_role;
REVOKE ALL ON conversation_states FROM anon;

-- Step 8: Create grant for functions (needed for RLS)
GRANT EXECUTE ON FUNCTION update_conversation_states_updated_at() TO service_role;

COMMIT;
