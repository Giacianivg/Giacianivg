-- Migration: Add COLLECT_NAME state to conversation_states enum
-- Author: Dex (@dev)
-- Date: 2026-03-08
-- Purpose: Expand conversation state machine from 7 to 8 states
-- Backward Compatibility: Existing records unaffected (new state inserted before ASK_DATES)

BEGIN TRANSACTION;

-- Step 1: Add COLLECT_NAME to existing enum type
-- PostgreSQL doesn't allow inserting values in the middle of enums,
-- so we create a new enum type and swap it
ALTER TYPE conversation_state RENAME TO conversation_state_old;

CREATE TYPE conversation_state AS ENUM (
  'GREETING',
  'COLLECT_NAME',
  'ASK_DATES',
  'ASK_GUESTS',
  'SHOW_ROOMS',
  'SEND_QUOTE',
  'CONFIRM_BOOKING',
  'HANDOFF_HUMAN'
);

-- Step 2: Migrate existing data (cast old enum values to new enum)
ALTER TABLE conversation_states
  ALTER COLUMN state TYPE conversation_state USING state::text::conversation_state;

-- Step 3: Drop old enum type
DROP TYPE conversation_state_old;

-- Step 4: Update table comments to reflect 8-state flow
COMMENT ON TABLE conversation_states IS
  'Persistent conversation state machine per guest (phone). Single source of truth for conversation progress. TTL = 24h. Enables deterministic 8-state funnel control (GREETING → COLLECT_NAME → ASK_DATES → ... → HANDOFF_HUMAN).';

COMMENT ON COLUMN conversation_states.state IS
  'Current state in 8-state funnel: GREETING → COLLECT_NAME → ASK_DATES → ASK_GUESTS → SHOW_ROOMS → SEND_QUOTE → CONFIRM_BOOKING → HANDOFF_HUMAN. Enum type = type-safe.';

-- Step 5: Update CHECK constraint (if it exists)
ALTER TABLE conversation_states
  DROP CONSTRAINT IF EXISTS valid_state_choice;

ALTER TABLE conversation_states
  ADD CONSTRAINT valid_state_choice CHECK (state IN ('GREETING', 'COLLECT_NAME', 'ASK_DATES', 'ASK_GUESTS', 'SHOW_ROOMS', 'SEND_QUOTE', 'CONFIRM_BOOKING', 'HANDOFF_HUMAN'));

COMMIT;
