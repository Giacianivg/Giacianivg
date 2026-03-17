-- =============================================================================
-- POUSADA LUZ DA LUA — SETUP COMPLETO DO BANCO DE DADOS
-- Script gerado automaticamente. Cole inteiro no Supabase SQL Editor.
-- Ordem correta de execução: 001_schema_initial → 016_fix_reservation_rpc
--
-- NOTA: auth.jwt_claims() em conversation_states pode gerar warning em
-- Supabase mais recente (use auth.jwt()). Não é crítico: o webhook usa
-- supabaseAdmin (service_role) que bypassa RLS de qualquer forma.
-- =============================================================================


-- ═════════════════════════════════════════════════════════════════════════════
-- [1/19] 001_schema_initial.sql — Schema base completo
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── DROP tudo (ordem inversa de dependência) ─────────────────────────────────
DROP VIEW IF EXISTS vw_urgent_proposals       CASCADE;
DROP VIEW IF EXISTS vw_revenue                CASCADE;
DROP VIEW IF EXISTS vw_occupancy_calendar     CASCADE;
DROP VIEW IF EXISTS vw_active_leads           CASCADE;
DROP VIEW IF EXISTS vw_occupancy_trends       CASCADE;
DROP VIEW IF EXISTS vw_funnel_trends          CASCADE;
DROP VIEW IF EXISTS vw_seasonality_analysis   CASCADE;
DROP VIEW IF EXISTS vw_room_performance       CASCADE;

DROP TABLE IF EXISTS revenue_alerts           CASCADE;
DROP TABLE IF EXISTS competitor_prices        CASCADE;
DROP TABLE IF EXISTS vouchers                 CASCADE;
DROP TABLE IF EXISTS rooms                    CASCADE;
DROP TABLE IF EXISTS luna_config_history      CASCADE;
DROP TABLE IF EXISTS luna_config              CASCADE;
DROP TABLE IF EXISTS blackboard_state         CASCADE;
DROP TABLE IF EXISTS scheduled_follow_ups     CASCADE;
DROP TABLE IF EXISTS occupancy_history        CASCADE;
DROP TABLE IF EXISTS conversion_funnel_history CASCADE;
DROP TABLE IF EXISTS conversation_states      CASCADE;
DROP TABLE IF EXISTS ai_logs                  CASCADE;
DROP TABLE IF EXISTS daily_metrics            CASCADE;
DROP TABLE IF EXISTS followups                CASCADE;
DROP TABLE IF EXISTS payments                 CASCADE;
DROP TABLE IF EXISTS proposals                CASCADE;
DROP TABLE IF EXISTS reservations             CASCADE;
DROP TABLE IF EXISTS availability             CASCADE;
DROP TABLE IF EXISTS conversations            CASCADE;
DROP TABLE IF EXISTS leads                    CASCADE;
DROP TABLE IF EXISTS settings                 CASCADE;

DROP TYPE IF EXISTS conversation_state CASCADE;

DROP FUNCTION IF EXISTS release_reservation(UUID, TEXT)                                                           CASCADE;
DROP FUNCTION IF EXISTS create_reservation_atomic(UUID, VARCHAR, VARCHAR, DATE, DATE, SMALLINT, DECIMAL, DECIMAL, UUID) CASCADE;
DROP FUNCTION IF EXISTS initialize_calendar(DATE, DATE)                                                           CASCADE;
DROP FUNCTION IF EXISTS generate_reservation_number()                                                             CASCADE;
DROP FUNCTION IF EXISTS generate_proposal_number()                                                                CASCADE;
DROP FUNCTION IF EXISTS touch_updated_at()                                                                        CASCADE;
DROP FUNCTION IF EXISTS auto_release_on_cancel()                                                                  CASCADE;
DROP FUNCTION IF EXISTS update_conversation_states_updated_at()                                                   CASCADE;
DROP FUNCTION IF EXISTS populate_occupancy_history(DATE)                                                          CASCADE;
DROP FUNCTION IF EXISTS populate_conversion_funnel(DATE)                                                          CASCADE;

DROP SEQUENCE IF EXISTS seq_reservations CASCADE;
DROP SEQUENCE IF EXISTS seq_proposals    CASCADE;

-- ─── EXTENSÃO ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- SEQUENCES
-- =============================================================================

CREATE SEQUENCE seq_reservations START 1 INCREMENT 1;
CREATE SEQUENCE seq_proposals    START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'RES-' || to_char(NOW(), 'YYYY') || '-' ||
         lpad(nextval('seq_reservations')::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_proposal_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'PROP-' || to_char(NOW(), 'YYYY') || '-' ||
         lpad(nextval('seq_proposals')::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 1. LEADS
-- =============================================================================

CREATE TABLE leads (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number     VARCHAR(20) UNIQUE NOT NULL,
  name                VARCHAR(150),
  email               VARCHAR(150),
  lead_source         VARCHAR(50)  DEFAULT 'whatsapp',
  funnel_stage        VARCHAR(30)  NOT NULL DEFAULT 'new',
  qualification_score SMALLINT     DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT leads_whatsapp_fmt CHECK (whatsapp_number ~ '^\d{10,15}$'),
  CONSTRAINT leads_funnel_check CHECK (
    funnel_stage IN ('new','qualified','proposal','negotiation','confirmed','lost')
  )
);

CREATE INDEX idx_leads_whatsapp ON leads(whatsapp_number);
CREATE INDEX idx_leads_stage    ON leads(funnel_stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_created  ON leads(created_at DESC);

CREATE TRIGGER trg_leads_updated
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- 2. CONVERSATIONS
-- =============================================================================

CREATE TABLE conversations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  whatsapp_number  VARCHAR(20) NOT NULL,
  role             VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT        NOT NULL,
  extracted_data   JSONB,
  token_usage      JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_lead    ON conversations(lead_id);
CREATE INDEX idx_conversations_number  ON conversations(whatsapp_number);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);

-- =============================================================================
-- 3. AVAILABILITY
-- =============================================================================

CREATE TABLE availability (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type      VARCHAR(20) NOT NULL,
  date           DATE        NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'available',
  reservation_id UUID,
  block_reason   TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT avail_room_check   CHECK (room_type IN ('ALA_A','ALA_B','ALA_C_1','ALA_C_2')),
  CONSTRAINT avail_status_check CHECK (status    IN ('available','reserved','blocked')),
  UNIQUE (room_type, date)
);

CREATE INDEX idx_avail_date        ON availability(date);
CREATE INDEX idx_avail_room_date   ON availability(room_type, date);
CREATE INDEX idx_avail_status_date ON availability(status, date);

-- =============================================================================
-- 4. RESERVATIONS
-- =============================================================================

CREATE TABLE reservations (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number TEXT          UNIQUE NOT NULL DEFAULT generate_reservation_number(),
  lead_id            UUID          NOT NULL REFERENCES leads(id),
  whatsapp_number    VARCHAR(20)   NOT NULL,
  room_type          VARCHAR(20)   NOT NULL,
  checkin_date       DATE          NOT NULL,
  checkout_date      DATE          NOT NULL,
  guests             SMALLINT      NOT NULL CHECK (guests > 0),
  total_amount       DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
  deposit_amount     DECIMAL(10,2) NOT NULL CHECK (deposit_amount > 0),
  balance_amount     DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - deposit_amount) STORED,
  status             VARCHAR(30)   NOT NULL DEFAULT 'pending',
  payment_method     VARCHAR(30),
  guest_notes        TEXT,
  internal_notes     TEXT,
  created_at         TIMESTAMPTZ   DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   DEFAULT NOW(),
  cancelled_at       TIMESTAMPTZ,

  CONSTRAINT res_dates_check  CHECK (checkout_date > checkin_date),
  CONSTRAINT res_room_check   CHECK (room_type IN ('ALA_A','ALA_B','ALA_C_1','ALA_C_2')),
  CONSTRAINT res_status_check CHECK (
    status IN ('pending','deposit_paid','confirmed','checked_in','completed','cancelled')
  )
);

CREATE INDEX idx_res_lead    ON reservations(lead_id);
CREATE INDEX idx_res_number  ON reservations(whatsapp_number);
CREATE INDEX idx_res_status  ON reservations(status);
CREATE INDEX idx_res_checkin ON reservations(checkin_date);
CREATE INDEX idx_res_res_num ON reservations(reservation_number);

CREATE TRIGGER trg_reservations_updated
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- FK circular: availability → reservations
ALTER TABLE availability
  ADD CONSTRAINT fk_avail_reservation
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;

-- =============================================================================
-- 5. PROPOSALS
-- =============================================================================

CREATE TABLE proposals (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number TEXT          UNIQUE NOT NULL DEFAULT generate_proposal_number(),
  lead_id         UUID          NOT NULL REFERENCES leads(id),
  whatsapp_number VARCHAR(20)   NOT NULL,
  room_type       VARCHAR(20)   NOT NULL,
  checkin_date    DATE          NOT NULL,
  checkout_date   DATE          NOT NULL,
  guests          SMALLINT      NOT NULL,
  nights          SMALLINT      NOT NULL
    GENERATED ALWAYS AS ((checkout_date - checkin_date)::INT) STORED,
  gross_amount    DECIMAL(10,2) NOT NULL,
  discount_pct    SMALLINT      DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  final_amount    DECIMAL(10,2) NOT NULL CHECK (final_amount > 0),
  deposit_amount  DECIMAL(10,2) NOT NULL,
  breakdown       JSONB,
  status          VARCHAR(20)   NOT NULL DEFAULT 'sent',
  validity_days   SMALLINT      DEFAULT 7,
  reservation_id  UUID          REFERENCES reservations(id),
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW(),

  CONSTRAINT prop_status_check CHECK (
    status IN ('sent','viewed','accepted','rejected','expired')
  )
);

CREATE INDEX idx_prop_lead    ON proposals(lead_id);
CREATE INDEX idx_prop_status  ON proposals(status);
CREATE INDEX idx_prop_created ON proposals(created_at DESC);
CREATE INDEX idx_prop_number  ON proposals(proposal_number);

CREATE TRIGGER trg_proposals_updated
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- 6. PAYMENTS
-- =============================================================================

CREATE TABLE payments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID          NOT NULL REFERENCES reservations(id),
  payment_type    VARCHAR(20)   NOT NULL CHECK (payment_type IN ('deposit','balance','full')),
  amount          DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  method          VARCHAR(20)   NOT NULL DEFAULT 'pix'
    CHECK (method IN ('pix','card','cash','transfer')),
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','confirmed','failed','refunded')),
  external_id     VARCHAR(100),
  qr_code_url     TEXT,
  pix_copy_paste  TEXT,
  expires_at      TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  webhook_payload JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_pay_reservation ON payments(reservation_id);
CREATE INDEX idx_pay_status      ON payments(status);
CREATE INDEX idx_pay_external    ON payments(external_id) WHERE external_id IS NOT NULL;

CREATE TRIGGER trg_payments_updated
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- 7. FOLLOWUPS
-- =============================================================================

CREATE TABLE followups (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  whatsapp_number  VARCHAR(20) NOT NULL,
  followup_type    VARCHAR(50) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','sent','replied','cancelled','failed')),
  scheduled_for    TIMESTAMPTZ NOT NULL,
  sent_at          TIMESTAMPTZ,
  message_template TEXT,
  lead_reply       TEXT,
  replied_at       TIMESTAMPTZ,
  attempts         SMALLINT    DEFAULT 0,
  next_attempt_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_followup_lead      ON followups(lead_id);
CREATE INDEX idx_followup_scheduled ON followups(scheduled_for) WHERE status = 'scheduled';

-- =============================================================================
-- 8. AI_LOGS
-- =============================================================================

CREATE TABLE ai_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID        REFERENCES leads(id),
  whatsapp_number VARCHAR(20),
  model           VARCHAR(60) NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  input_tokens    INT,
  output_tokens   INT,
  latency_ms      INT,
  cost_usd        DECIMAL(10,6),
  status          VARCHAR(20) DEFAULT 'success'
    CHECK (status IN ('success','error','timeout')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ailogs_lead    ON ai_logs(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_ailogs_created ON ai_logs(created_at DESC);

-- =============================================================================
-- 9. DAILY_METRICS
-- =============================================================================

CREATE TABLE daily_metrics (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  date                     DATE          NOT NULL UNIQUE,
  new_leads                INT           DEFAULT 0,
  qualified_leads          INT           DEFAULT 0,
  proposals_sent           INT           DEFAULT 0,
  proposals_accepted       INT           DEFAULT 0,
  reservations_confirmed   INT           DEFAULT 0,
  lead_conversion_rate     DECIMAL(5,2),
  proposal_conversion_rate DECIMAL(5,2),
  revenue_day              DECIMAL(12,2) DEFAULT 0,
  rooms_occupied           SMALLINT      DEFAULT 0,
  ai_cost_usd              DECIMAL(8,4)  DEFAULT 0,
  created_at               TIMESTAMPTZ   DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_metrics_date ON daily_metrics(date DESC);

CREATE TRIGGER trg_metrics_updated
  BEFORE UPDATE ON daily_metrics
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- 10. SETTINGS
-- =============================================================================

CREATE TABLE settings (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) UNIQUE NOT NULL,
  value       TEXT,
  value_type  VARCHAR(20)  CHECK (value_type IN ('string','number','boolean','json')),
  description TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TRIGGER trg_settings_updated
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_leads"         ON leads         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "manager_conversations" ON conversations  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "manager_availability"  ON availability  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "manager_reservations"  ON reservations  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "manager_proposals"     ON proposals     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "manager_followups"     ON followups     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "manager_payments"      ON payments      FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager_ai_logs"       ON ai_logs       FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager_metrics"       ON daily_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager_settings"      ON settings      FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- RPC: initialize_calendar
-- =============================================================================

CREATE OR REPLACE FUNCTION initialize_calendar(p_start DATE, p_end DATE)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  v_rooms TEXT[] := ARRAY['ALA_A','ALA_B','ALA_C_1','ALA_C_2'];
  v_room  TEXT;
  v_date  DATE;
  v_count INT := 0;
BEGIN
  FOREACH v_room IN ARRAY v_rooms LOOP
    v_date := p_start;
    WHILE v_date < p_end LOOP
      INSERT INTO availability (room_type, date, status)
      VALUES (v_room, v_date, 'available')
      ON CONFLICT (room_type, date) DO NOTHING;
      v_date  := v_date + INTERVAL '1 day';
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$;

-- =============================================================================
-- RPC: release_reservation
-- =============================================================================

CREATE OR REPLACE FUNCTION release_reservation(p_reservation_id UUID, p_reason TEXT DEFAULT 'cancelled')
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_res reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_res FROM reservations WHERE id = p_reservation_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success',false,'error','not_found');
  END IF;

  IF v_res.status IN ('cancelled','completed') THEN
    RETURN json_build_object('success',false,'error','invalid_status','message','Reserva já está ' || v_res.status);
  END IF;

  UPDATE availability
  SET status = 'available', reservation_id = NULL, block_reason = NULL, updated_at = NOW()
  WHERE reservation_id = p_reservation_id;

  UPDATE reservations
  SET status = 'cancelled', cancelled_at = NOW(),
      internal_notes = COALESCE(internal_notes || ' | ','') || 'Cancelled: ' || p_reason,
      updated_at = NOW()
  WHERE id = p_reservation_id;

  RETURN json_build_object('success',true,'reservation_id',p_reservation_id);
END;
$$;

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW vw_active_leads AS
SELECT * FROM leads WHERE deleted_at IS NULL AND funnel_stage != 'lost';

CREATE OR REPLACE VIEW vw_occupancy_calendar AS
SELECT a.date, a.room_type, a.status,
       r.reservation_number, r.guests,
       l.name AS guest_name, l.whatsapp_number
FROM availability a
LEFT JOIN reservations r ON r.id = a.reservation_id
LEFT JOIN leads        l ON l.id = r.lead_id
ORDER BY a.date, a.room_type;

CREATE OR REPLACE VIEW vw_revenue AS
SELECT
  COUNT(*) AS total_reservations,
  COALESCE(SUM(CASE WHEN status IN ('confirmed','checked_in','completed') THEN total_amount   ELSE 0 END),0) AS confirmed_revenue,
  COALESCE(SUM(CASE WHEN status = 'pending'                               THEN total_amount   ELSE 0 END),0) AS pending_revenue,
  COALESCE(SUM(CASE WHEN status IN ('confirmed','checked_in','completed') THEN deposit_amount ELSE 0 END),0) AS deposits_received
FROM reservations WHERE status != 'cancelled';

CREATE OR REPLACE VIEW vw_urgent_proposals AS
SELECT p.proposal_number, p.created_at, p.final_amount, p.checkin_date, p.checkout_date,
       l.name AS lead_name, l.whatsapp_number,
       EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 AS hours_without_reply
FROM proposals p JOIN leads l ON l.id = p.lead_id
WHERE p.status = 'sent' AND p.created_at < NOW() - INTERVAL '48 hours'
ORDER BY p.created_at ASC;

-- =============================================================================
-- SEED: configurações padrão
-- =============================================================================

INSERT INTO settings (key, value, value_type, description) VALUES
  ('inn_name',               'Pousada Luz da Lua','string', 'Nome da pousada'),
  ('team_whatsapp',          '5519998400306',     'string', 'WhatsApp da equipe'),
  ('deposit_percentage',     '30',                'number', '% de sinal para confirmar reserva'),
  ('checkin_time',           '14:00',             'string', 'Horário padrão de check-in'),
  ('checkout_time',          '11:00',             'string', 'Horário padrão de check-out'),
  ('late_checkout_fee',      '50',                'number', 'Taxa check-out tardio (R$)'),
  ('late_checkin_fee',       '50',                'number', 'Taxa check-in após 18h (R$)'),
  ('proposal_followup_hours','24',                'number', 'Horas para follow-up após proposta'),
  ('checkin_reminder_hours', '48',                'number', 'Horas antes do check-in para lembrete'),
  ('pix_expiry_hours',       '48',                'number', 'Validade do QR Code PIX em horas'),
  ('mercadopago_sandbox',    'true',              'boolean','Usar sandbox do MercadoPago')
ON CONFLICT (key) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- [2/19] 001_create_conversation_states.sql — Estado da conversa por hóspede
-- ═════════════════════════════════════════════════════════════════════════════

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

CREATE TABLE conversation_states (
  lead_id UUID PRIMARY KEY,

  CONSTRAINT fk_conversation_states_lead_id
    FOREIGN KEY (lead_id)
    REFERENCES leads(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  phone VARCHAR(20) NOT NULL UNIQUE,
  state conversation_state NOT NULL DEFAULT 'GREETING',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),

  CONSTRAINT expires_in_future CHECK (expires_at > created_at),
  CONSTRAINT phone_format CHECK (phone ~ '^\+?55\d{9,11}$' OR phone ~ '^\d{10,11}$'),
  CONSTRAINT valid_state_choice CHECK (state IN ('GREETING', 'COLLECT_NAME', 'ASK_DATES', 'ASK_GUESTS', 'SHOW_ROOMS', 'SEND_QUOTE', 'CONFIRM_BOOKING', 'HANDOFF_HUMAN'))
);

COMMENT ON TABLE conversation_states IS
  'Persistent conversation state machine per guest (phone). Single source of truth for conversation progress. TTL = 24h. Enables deterministic 7-state funnel control.';

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

CREATE UNIQUE INDEX idx_conversation_states_phone
  ON conversation_states (phone);

CREATE INDEX idx_conversation_states_expires_at
  ON conversation_states (expires_at)
  WHERE state != 'HANDOFF_HUMAN';

CREATE INDEX idx_conversation_states_state
  ON conversation_states (state, created_at DESC);

CREATE INDEX idx_conversation_states_created_at
  ON conversation_states (created_at DESC);

ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;

-- Política permissiva para service_role (webhook usa supabaseAdmin que bypassa RLS)
CREATE POLICY "service_internal_access"
  ON conversation_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON conversation_states TO service_role;
REVOKE ALL ON conversation_states FROM anon;
GRANT EXECUTE ON FUNCTION update_conversation_states_updated_at() TO service_role;


-- [3/19] 002_add_collect_name_state.sql — já incorporado: enum criado com 8 valores em [2/19]


-- ═════════════════════════════════════════════════════════════════════════════
-- [4/19] 002_calendar_seed.sql — Semente do calendário de disponibilidade 2026
-- ═════════════════════════════════════════════════════════════════════════════

SELECT initialize_calendar('2026-01-01', '2027-01-01');


-- ═════════════════════════════════════════════════════════════════════════════
-- [5/19] 002_phase1_production_fixes.sql — FK explícitas + índices + trigger
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS fk_res_lead;
ALTER TABLE reservations
  ADD CONSTRAINT fk_res_lead
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT;

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS fk_prop_lead;
ALTER TABLE proposals
  ADD CONSTRAINT fk_prop_lead
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_pay_reservation;
ALTER TABLE payments
  ADD CONSTRAINT fk_pay_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_reservations_active_occupancy
  ON reservations(checkin_date, checkout_date)
  WHERE status IN ('confirmed', 'checked_in', 'completed');

CREATE INDEX IF NOT EXISTS idx_proposals_expiry
  ON proposals(status, created_at DESC)
  WHERE status IN ('sent', 'viewed');

CREATE INDEX IF NOT EXISTS idx_payments_pending
  ON payments(created_at DESC)
  WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION auto_release_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE availability
    SET
      status = 'available',
      reservation_id = NULL,
      block_reason = NULL,
      updated_at = NOW()
    WHERE reservation_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_release_cancelled ON reservations;

CREATE TRIGGER trg_auto_release_cancelled
  AFTER UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION auto_release_on_cancel();

ALTER TABLE conversations SET (autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE ai_logs SET (autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE followups SET (autovacuum_vacuum_scale_factor = 0.05);


-- ═════════════════════════════════════════════════════════════════════════════
-- [6/19] 003_phase2_rms_tables.sql — Tabelas históricas para RMS / forecasting
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS occupancy_history (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  DATE          NOT NULL,
  room_type             VARCHAR(20)   NOT NULL,
  total_units           SMALLINT      NOT NULL CHECK (total_units > 0),
  occupied_units        SMALLINT      NOT NULL DEFAULT 0
    CHECK (occupied_units >= 0 AND occupied_units <= total_units),
  occupancy_rate        DECIMAL(3,2)  GENERATED ALWAYS AS (
    CASE
      WHEN total_units = 0 THEN NULL
      ELSE ROUND((occupied_units::DECIMAL / total_units), 2)
    END
  ) STORED,
  price_charged         DECIMAL(10,2),
  revenue_generated     DECIMAL(12,2) CHECK (revenue_generated >= 0),
  season                VARCHAR(20)   CHECK (season IS NULL OR season IN ('baixa', 'media', 'alta', 'holiday')),
  day_of_week           VARCHAR(10)   CHECK (day_of_week IS NULL OR day_of_week IN (
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
  )),
  demand_indicator      VARCHAR(20)   DEFAULT 'normal'
    CHECK (demand_indicator IN ('low', 'normal', 'high', 'peak')),
  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (date, room_type),
  CHECK (date <= CURRENT_DATE)
);

CREATE INDEX IF NOT EXISTS idx_occupancy_date      ON occupancy_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_occupancy_room_date ON occupancy_history(room_type, date DESC);
CREATE INDEX IF NOT EXISTS idx_occupancy_season    ON occupancy_history(season, date DESC);
CREATE INDEX IF NOT EXISTS idx_occupancy_demand    ON occupancy_history(demand_indicator, date DESC);

DROP TRIGGER IF EXISTS trg_occupancy_updated ON occupancy_history;
CREATE TRIGGER trg_occupancy_updated
  BEFORE UPDATE ON occupancy_history
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE occupancy_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "occupancy_authenticated_all"
  ON occupancy_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS conversion_funnel_history (
  id                         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  date                       DATE          NOT NULL UNIQUE,
  leads_new                  INT           DEFAULT 0 CHECK (leads_new >= 0),
  leads_qualified            INT           DEFAULT 0 CHECK (leads_qualified >= 0),
  leads_proposal_sent        INT           DEFAULT 0 CHECK (leads_proposal_sent >= 0),
  leads_confirmed            INT           DEFAULT 0 CHECK (leads_confirmed >= 0),
  leads_lost                 INT           DEFAULT 0 CHECK (leads_lost >= 0),
  conv_new_to_qualified      DECIMAL(5,2)  CHECK (conv_new_to_qualified IS NULL OR (conv_new_to_qualified >= 0 AND conv_new_to_qualified <= 100)),
  conv_qualified_to_proposal DECIMAL(5,2)  CHECK (conv_qualified_to_proposal IS NULL OR (conv_qualified_to_proposal >= 0 AND conv_qualified_to_proposal <= 100)),
  conv_proposal_to_confirmed DECIMAL(5,2)  CHECK (conv_proposal_to_confirmed IS NULL OR (conv_proposal_to_confirmed >= 0 AND conv_proposal_to_confirmed <= 100)),
  overall_conversion         DECIMAL(5,2)  CHECK (overall_conversion IS NULL OR (overall_conversion >= 0 AND overall_conversion <= 100)),
  revenue_day                DECIMAL(12,2) DEFAULT 0 CHECK (revenue_day >= 0),
  avg_booking_value          DECIMAL(10,2) CHECK (avg_booking_value IS NULL OR avg_booking_value >= 0),
  created_at                 TIMESTAMPTZ   DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ   DEFAULT NOW(),
  CHECK (date <= CURRENT_DATE)
);

CREATE INDEX IF NOT EXISTS idx_conv_date    ON conversion_funnel_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_conv_created ON conversion_funnel_history(created_at DESC);

DROP TRIGGER IF EXISTS trg_conv_updated ON conversion_funnel_history;
CREATE TRIGGER trg_conv_updated
  BEFORE UPDATE ON conversion_funnel_history
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE conversion_funnel_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_authenticated_all"
  ON conversion_funnel_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE VIEW vw_occupancy_trends AS
SELECT
  date, room_type, occupancy_rate, price_charged, revenue_generated,
  season, demand_indicator,
  AVG(occupancy_rate) OVER (
    PARTITION BY room_type ORDER BY date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as occupancy_rate_7d_avg
FROM occupancy_history
ORDER BY date DESC, room_type;

CREATE OR REPLACE VIEW vw_funnel_trends AS
SELECT
  date, leads_new, leads_qualified, leads_proposal_sent, leads_confirmed,
  leads_lost, overall_conversion, revenue_day,
  AVG(overall_conversion) OVER (
    ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as conversion_7d_avg,
  LAG(overall_conversion) OVER (ORDER BY date) as prior_day_conversion
FROM conversion_funnel_history
ORDER BY date DESC;

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

CREATE OR REPLACE VIEW vw_room_performance AS
SELECT
  room_type,
  COUNT(*) as days_tracked,
  AVG(occupancy_rate) as avg_occupancy,
  SUM(revenue_generated) as total_revenue,
  AVG(price_charged) as avg_nightly_rate,
  SUM(occupied_units) as total_nights_occupied,
  ROUND(SUM(revenue_generated) / NULLIF(SUM(occupied_units), 0), 2) as adr,
  ROUND(SUM(revenue_generated) / NULLIF(COUNT(*), 0), 2) as revpar
FROM occupancy_history
GROUP BY room_type
ORDER BY total_revenue DESC;

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
      p_date, v_room, 1,
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
        WHEN EXTRACT(MONTH FROM p_date) IN (2, 4, 5, 8, 9, 10) AND EXTRACT(DOW FROM p_date) NOT IN (0, 6) THEN 'baixa'
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

CREATE OR REPLACE FUNCTION populate_conversion_funnel(p_date DATE)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_leads_new INT; v_leads_qualified INT; v_leads_proposal_sent INT;
  v_leads_confirmed INT; v_leads_lost INT; v_revenue_day DECIMAL(12,2);
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE DATE(l.created_at) = p_date AND l.funnel_stage = 'new'),
    COUNT(*) FILTER (WHERE l.funnel_stage = 'qualified' AND DATE(l.updated_at) = p_date),
    COUNT(*) FILTER (WHERE DATE(p.created_at) = p_date AND p.status = 'sent'),
    COUNT(*) FILTER (WHERE l.funnel_stage = 'confirmed' AND DATE(l.updated_at) = p_date),
    COUNT(*) FILTER (WHERE l.funnel_stage = 'lost' AND DATE(l.updated_at) = p_date),
    COALESCE(SUM(r.total_amount), 0)
  INTO v_leads_new, v_leads_qualified, v_leads_proposal_sent, v_leads_confirmed, v_leads_lost, v_revenue_day
  FROM leads l
  LEFT JOIN proposals p ON p.lead_id = l.id
  LEFT JOIN reservations r ON r.lead_id = l.id AND DATE(r.created_at) = p_date
    AND r.status IN ('confirmed', 'checked_in', 'completed');

  INSERT INTO conversion_funnel_history (
    date, leads_new, leads_qualified, leads_proposal_sent, leads_confirmed, leads_lost, revenue_day
  )
  VALUES (p_date, v_leads_new, v_leads_qualified, v_leads_proposal_sent, v_leads_confirmed, v_leads_lost, v_revenue_day)
  ON CONFLICT (date) DO UPDATE SET
    leads_new = EXCLUDED.leads_new, leads_qualified = EXCLUDED.leads_qualified,
    leads_proposal_sent = EXCLUDED.leads_proposal_sent, leads_confirmed = EXCLUDED.leads_confirmed,
    leads_lost = EXCLUDED.leads_lost, revenue_day = EXCLUDED.revenue_day, updated_at = NOW();
  RETURN TRUE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- [7/19] 004_add_lead_scoring.sql — Colunas de scoring na tabela leads
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_label TEXT DEFAULT 'cold';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);


-- ═════════════════════════════════════════════════════════════════════════════
-- [8/19] 005_add_follow_ups.sql — Tabela scheduled_follow_ups (v1, NOT NULL)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scheduled_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  follow_up_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  template_name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sfu_pending ON scheduled_follow_ups(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_sfu_lead ON scheduled_follow_ups(lead_id);

ALTER TABLE scheduled_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sfu_authenticated_all"
  ON scheduled_follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ═════════════════════════════════════════════════════════════════════════════
-- [9/19] 006_add_lead_alerts.sql — Colunas de alerta na tabela leads
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE leads ADD COLUMN IF NOT EXISTS alert_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS alert_message TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS alert_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_alert_type ON leads(alert_type) WHERE alert_type IS NOT NULL;


-- ═════════════════════════════════════════════════════════════════════════════
-- [10/19] 007_blackboard_state.sql — Estado compartilhado entre agentes AI-OS
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS blackboard_state (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO blackboard_state (key, value) VALUES
  ('leads',      '{"total":0,"ativos":0,"score_medio":0,"ultimo_update":null}'),
  ('reservas',   '{"hoje":0,"semana":0,"mes":0,"ocupacao_pct":0}'),
  ('financeiro', '{"mrr":0,"cac":0,"ticket_medio":0}'),
  ('alertas',    '[]')
ON CONFLICT (key) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- [11/19] 008_luna_config.sql — Configuração e treinamento da Luna
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS luna_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt   TEXT        NOT NULL DEFAULT '',
  personality     JSONB       NOT NULL DEFAULT '{"nome":"Luna","tom":"acolhedor","emoji":true}',
  scripts         JSONB       NOT NULL DEFAULT '{"saudacao":"","cotacao":"","objecao":"","fechamento":""}',
  active_packages JSONB       NOT NULL DEFAULT '[]',
  version         INT         NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      TEXT        NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS luna_config_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt   TEXT        NOT NULL DEFAULT '',
  personality     JSONB       NOT NULL DEFAULT '{}',
  scripts         JSONB       NOT NULL DEFAULT '{}',
  active_packages JSONB       NOT NULL DEFAULT '[]',
  version         INT         NOT NULL,
  saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_by        TEXT        NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_luna_history_version ON luna_config_history (version DESC);

INSERT INTO luna_config (
  id, system_prompt, personality, scripts, active_packages, version, updated_by
) VALUES (
  '10000000-0000-0000-0000-000000000009'::uuid,
  '',
  '{"nome":"Luna","tom":"acolhedor","emoji":true}',
  '{"saudacao":"","cotacao":"","objecao":"","fechamento":""}',
  '[]',
  1,
  'system'
) ON CONFLICT (id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- [12/19] 009_rooms.sql — Metadados dos quartos da pousada
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rooms (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT        UNIQUE NOT NULL,
  availability_codes  JSONB       NOT NULL DEFAULT '[]',
  name                TEXT        NOT NULL,
  description         TEXT        NOT NULL DEFAULT '',
  max_guests          INT         NOT NULL DEFAULT 2,
  base_price_baixa    NUMERIC(10,2) NOT NULL DEFAULT 300.00,
  base_price_media    NUMERIC(10,2) NOT NULL DEFAULT 300.00,
  base_price_alta     NUMERIC(10,2) NOT NULL DEFAULT 400.00,
  amenities           JSONB       NOT NULL DEFAULT '[]',
  active              BOOLEAN     NOT NULL DEFAULT true,
  sort_order          INT         NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms (active, sort_order);

INSERT INTO rooms (code, availability_codes, name, description, max_guests,
                   base_price_baixa, base_price_media, base_price_alta, amenities, sort_order)
VALUES
  ('ALA_A', '["ALA_A"]', 'Ala A', 'Quarto aconchegante ideal para casais ou pequenos grupos. Vista para o jardim, cama queen size e varanda privativa.', 3, 300.00, 300.00, 400.00, '["Ar-condicionado","Wi-Fi","TV 32\"","Frigobar","Varanda","Cama queen size"]', 1),
  ('ALA_B', '["ALA_B"]', 'Ala B', 'Quarto espaçoso para familias. Duas camas de casal e sala de estar integrada com vista para a piscina.', 5, 300.00, 350.00, 400.00, '["Ar-condicionado","Wi-Fi","TV 42\"","Frigobar","Sala de estar","Vista piscina","2 camas de casal"]', 2),
  ('ALA_C_CASAL', '["ALA_C_1","ALA_C_2"]', 'Ala C — Casal', 'Suite premium para grupos maiores. Dois quartos interligados com sala comum, perfeita para familias grandes ou grupos de amigos.', 8, 300.00, 300.00, 400.00, '["Ar-condicionado","Wi-Fi","TV 42\"","Frigobar","Sala comum","2 banheiros","Varanda ampla","Churrasqueira privativa"]', 3),
  ('ALA_C_GRUPO', '[]', 'Ala C — Grupo', 'Espaco exclusivo para grupos grandes. Configuracao personalizada mediante consulta com a equipe. Disponibilidade e valores sob cotacao.', 99, 150.00, 150.00, 150.00, '["Espaco exclusivo","Configuracao personalizada","Churrasqueira","Piscina privativa","Atendimento VIP"]', 4)
ON CONFLICT (code) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- [13/19] 010_vouchers.sql — Vouchers de hospedagem
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vouchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
  guest_name      TEXT NOT NULL,
  room_type       TEXT NOT NULL,
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  guests          INTEGER NOT NULL DEFAULT 1,
  source          TEXT NOT NULL DEFAULT 'direct'
                    CHECK (source IN ('direct', 'booking', 'expedia', 'whatsapp')),
  total_amount    NUMERIC(10, 2),
  download_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_guest_name     ON vouchers (lower(guest_name));
CREATE INDEX IF NOT EXISTS idx_vouchers_source         ON vouchers (source);
CREATE INDEX IF NOT EXISTS idx_vouchers_status         ON vouchers (status);
CREATE INDEX IF NOT EXISTS idx_vouchers_download_token ON vouchers (download_token);
CREATE INDEX IF NOT EXISTS idx_vouchers_check_in       ON vouchers (check_in);


-- ═════════════════════════════════════════════════════════════════════════════
-- [14/19] 011_scheduled_follow_ups_nullable_lead.sql — lead_id nullable
-- Supersede 005: torna lead_id opcional (criada acima com NOT NULL, agora altera)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE scheduled_follow_ups
  ALTER COLUMN lead_id DROP NOT NULL;

-- Recriar índice sfu_lead com WHERE lead_id IS NOT NULL
DROP INDEX IF EXISTS idx_sfu_lead;
CREATE INDEX IF NOT EXISTS idx_sfu_lead
  ON scheduled_follow_ups(lead_id)
  WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN scheduled_follow_ups.lead_id IS
  'Opcional — NULL quando o follow-up é criado sem lead associado (ex: seed de exemplo).';


-- ═════════════════════════════════════════════════════════════════════════════
-- [15/19] 012_quartos_reais.sql — Quartos individuais reais da pousada
-- ═════════════════════════════════════════════════════════════════════════════

-- Desativa registros genéricos (mantém histórico)
UPDATE rooms SET active = false WHERE code IN ('ALA_A', 'ALA_B', 'ALA_C_CASAL', 'ALA_C_GRUPO');

-- ALA A — Vista para o Pomar — A1-A3 (max 3 hóspedes)
INSERT INTO rooms (code, availability_codes, name, description, max_guests, base_price_baixa, base_price_media, base_price_alta, amenities, sort_order)
VALUES
  ('A1','["A1"]','Quarto A1 — Vista Pomar','Quarto com vista para o pomar, 1 cama de casal e 1 cama de solteiro, varanda com rede.',3,280.00,280.00,400.00,'["Cama de casal","Cama de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',10),
  ('A2','["A2"]','Quarto A2 — Vista Pomar','Quarto com vista para o pomar, 1 cama de casal e 1 cama de solteiro, varanda com rede.',3,280.00,280.00,400.00,'["Cama de casal","Cama de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',20),
  ('A3','["A3"]','Quarto A3 — Vista Pomar','Quarto com vista para o pomar, 1 cama de casal e 1 cama de solteiro, varanda com rede.',3,280.00,280.00,400.00,'["Cama de casal","Cama de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',30)
ON CONFLICT (code) DO NOTHING;

-- ALA A — A4-A8 (max 4 hóspedes)
INSERT INTO rooms (code, availability_codes, name, description, max_guests, base_price_baixa, base_price_media, base_price_alta, amenities, sort_order)
VALUES
  ('A4','["A4"]','Quarto A4 — Vista Pomar','Quarto familiar com vista para o pomar, 1 cama de casal e 2 camas de solteiro, varanda com rede.',4,320.00,320.00,440.00,'["Cama de casal","2 Camas de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',40),
  ('A5','["A5"]','Quarto A5 — Vista Pomar','Quarto familiar com vista para o pomar, 1 cama de casal e 2 camas de solteiro, varanda com rede.',4,320.00,320.00,440.00,'["Cama de casal","2 Camas de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',50),
  ('A6','["A6"]','Quarto A6 — Vista Pomar','Quarto familiar com vista para o pomar, 1 cama de casal e 2 camas de solteiro, varanda com rede.',4,320.00,320.00,440.00,'["Cama de casal","2 Camas de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',60),
  ('A7','["A7"]','Quarto A7 — Vista Pomar','Quarto familiar com vista para o pomar, 1 cama de casal e 2 camas de solteiro, varanda com rede.',4,320.00,320.00,440.00,'["Cama de casal","2 Camas de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',70),
  ('A8','["A8"]','Quarto A8 — Vista Pomar','Quarto familiar com vista para o pomar, 1 cama de casal e 2 camas de solteiro, varanda com rede.',4,320.00,320.00,440.00,'["Cama de casal","2 Camas de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',80)
ON CONFLICT (code) DO NOTHING;

-- ALA B — Vista para a Montanha — B1 (max 3 hóspedes)
INSERT INTO rooms (code, availability_codes, name, description, max_guests, base_price_baixa, base_price_media, base_price_alta, amenities, sort_order)
VALUES
  ('B1','["B1"]','Quarto B1 — Vista Montanha','Quarto com deslumbrante vista para a montanha, 1 cama de casal e 1 cama de solteiro.',3,300.00,300.00,420.00,'["Cama de casal","Cama de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',110)
ON CONFLICT (code) DO NOTHING;

-- ALA B — B2-B7 (max 6 hóspedes)
INSERT INTO rooms (code, availability_codes, name, description, max_guests, base_price_baixa, base_price_media, base_price_alta, amenities, sort_order)
VALUES
  ('B2','["B2"]','Quarto B2 — Vista Montanha','Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',6,380.00,380.00,500.00,'["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',120),
  ('B3','["B3"]','Quarto B3 — Vista Montanha','Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',6,380.00,380.00,500.00,'["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',130),
  ('B4','["B4"]','Quarto B4 — Vista Montanha','Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',6,380.00,380.00,500.00,'["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',140),
  ('B5','["B5"]','Quarto B5 — Vista Montanha','Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',6,380.00,380.00,500.00,'["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',150),
  ('B6','["B6"]','Quarto B6 — Vista Montanha','Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',6,380.00,380.00,500.00,'["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',160),
  ('B7','["B7"]','Quarto B7 — Vista Montanha','Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',6,380.00,380.00,500.00,'["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',170)
ON CONFLICT (code) DO NOTHING;

-- ALA C — Quarto do Campo — C1-C2 (max 8 hóspedes)
INSERT INTO rooms (code, availability_codes, name, description, max_guests, base_price_baixa, base_price_media, base_price_alta, amenities, sort_order)
VALUES
  ('C1','["C1"]','Quarto do Campo C1 — Grupo','Quarto do campo espaçoso, ideal para grupos de até 8 pessoas.',8,480.00,480.00,620.00,'["Múltiplas camas","TV 20\"","Quarto do Campo"]',210),
  ('C2','["C2"]','Quarto do Campo C2 — Grupo','Quarto do campo espaçoso, ideal para grupos de até 8 pessoas.',8,480.00,480.00,620.00,'["Múltiplas camas","TV 20\"","Quarto do Campo"]',220)
ON CONFLICT (code) DO NOTHING;

-- ALA C — C3-C5 (max 2 hóspedes)
INSERT INTO rooms (code, availability_codes, name, description, max_guests, base_price_baixa, base_price_media, base_price_alta, amenities, sort_order)
VALUES
  ('C3','["C3"]','Quarto do Campo C3 — Casal','Quarto do campo aconchegante para casal.',2,260.00,260.00,380.00,'["Cama de casal","TV 20\"","Quarto do Campo"]',230),
  ('C4','["C4"]','Quarto do Campo C4 — Casal','Quarto do campo aconchegante para casal.',2,260.00,260.00,380.00,'["Cama de casal","TV 20\"","Quarto do Campo"]',240),
  ('C5','["C5"]','Quarto do Campo C5 — Casal','Quarto do campo aconchegante para casal.',2,260.00,260.00,380.00,'["Cama de casal","TV 20\"","Quarto do Campo"]',250)
ON CONFLICT (code) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════════════
-- [16/19] 013_reservations_channel.sql — channel, notes, checkin_at, checkout_at
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'booking', 'airbnb', 'direct', 'phone', 'other')),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS checkin_at  timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_reservations_channel ON reservations(channel);

COMMENT ON COLUMN reservations.channel     IS 'Canal de origem: whatsapp | booking | airbnb | direct | phone | other';
COMMENT ON COLUMN reservations.notes       IS 'Observações internas da equipe';
COMMENT ON COLUMN reservations.checkin_at  IS 'Timestamp real do check-in no front-desk';
COMMENT ON COLUMN reservations.checkout_at IS 'Timestamp real do check-out no front-desk';


-- ═════════════════════════════════════════════════════════════════════════════
-- [17/19] 014_competitor_prices.sql — Inteligência de preços regional
-- ═════════════════════════════════════════════════════════════════════════════

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

CREATE INDEX IF NOT EXISTS idx_cp_date            ON competitor_prices(date);
CREATE INDEX IF NOT EXISTS idx_cp_competitor_date ON competitor_prices(competitor_name, date);
CREATE INDEX IF NOT EXISTS idx_cp_platform        ON competitor_prices(platform);

COMMENT ON TABLE competitor_prices IS 'Preços de pousadas concorrentes por data. Fonte: Apify (automático) ou entrada manual.';


-- ═════════════════════════════════════════════════════════════════════════════
-- [18/19] 015_revenue_alerts.sql — Alertas de Revenue Intelligence (Maxwell)
-- ═════════════════════════════════════════════════════════════════════════════

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
  data         jsonb,
  date_ref     date,
  room_type    text,
  dismissed    boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ra_created_at ON revenue_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ra_urgency    ON revenue_alerts(urgency) WHERE dismissed = false;
CREATE INDEX IF NOT EXISTS idx_ra_date_ref   ON revenue_alerts(date_ref);
CREATE INDEX IF NOT EXISTS idx_ra_dismissed  ON revenue_alerts(dismissed, created_at DESC);

COMMENT ON TABLE revenue_alerts IS 'Alertas de revenue intelligence gerados por Maxwell (@revenue-agent). Leitura: GET /api/alerts/revenue.';


-- ═════════════════════════════════════════════════════════════════════════════
-- [19/19] 016_fix_reservation_rpc.sql — Corrige create_reservation_atomic
-- Bug: FOR UPDATE com COUNT(*) direto. Fix: CTE com FOR UPDATE, COUNT() depois.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_reservation_atomic(
  p_lead_id        UUID,
  p_whatsapp       VARCHAR(20),
  p_room_type      VARCHAR(20),
  p_checkin        DATE,
  p_checkout       DATE,
  p_guests         SMALLINT,
  p_total_amount   DECIMAL(10,2),
  p_deposit_amount DECIMAL(10,2),
  p_proposal_id    UUID DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  v_physical_room   VARCHAR(20);
  v_nights_required INT;
  v_nights_free     INT;
  v_reservation_id  UUID;
  v_res_number      TEXT;
BEGIN
  v_nights_required := (p_checkout - p_checkin)::INT;

  IF p_room_type IN ('ALA_A','ALA_B') THEN
    v_physical_room := p_room_type;
  ELSIF p_room_type = 'ALA_C_CASAL' THEN
    SELECT q INTO v_physical_room
    FROM (VALUES ('ALA_C_1'),('ALA_C_2')) AS t(q)
    WHERE (
      SELECT COUNT(*) FROM availability
      WHERE room_type = t.q
        AND date >= p_checkin AND date < p_checkout
        AND status = 'available'
    ) = v_nights_required
    LIMIT 1;
  ELSE
    RETURN json_build_object('success',false,'error','invalid_room_type','message','Use ALA_A, ALA_B ou ALA_C_CASAL.');
  END IF;

  IF v_physical_room IS NULL THEN
    RETURN json_build_object('success',false,'error','no_availability','message','Quarto indisponível para o período.');
  END IF;

  -- FIX: CTE bloqueia rows individualmente (FOR UPDATE), COUNT() no resultado
  WITH locked AS (
    SELECT id FROM availability
    WHERE room_type = v_physical_room
      AND date >= p_checkin AND date < p_checkout
      AND status = 'available'
    FOR UPDATE NOWAIT
  )
  SELECT COUNT(*) INTO v_nights_free FROM locked;

  IF v_nights_free < v_nights_required THEN
    RETURN json_build_object('success',false,'error','no_availability','message','Quarto indisponível para o período.');
  END IF;

  INSERT INTO reservations (
    lead_id, whatsapp_number, room_type,
    checkin_date, checkout_date, guests,
    total_amount, deposit_amount, status
  ) VALUES (
    p_lead_id, p_whatsapp, v_physical_room,
    p_checkin, p_checkout, p_guests,
    p_total_amount, p_deposit_amount, 'pending'
  ) RETURNING id, reservation_number INTO v_reservation_id, v_res_number;

  UPDATE availability
  SET status = 'reserved', reservation_id = v_reservation_id, updated_at = NOW()
  WHERE room_type = v_physical_room AND date >= p_checkin AND date < p_checkout;

  IF p_proposal_id IS NOT NULL THEN
    UPDATE proposals SET reservation_id = v_reservation_id, status = 'accepted', updated_at = NOW()
    WHERE id = p_proposal_id;
  END IF;

  UPDATE leads SET funnel_stage = 'confirmed', updated_at = NOW() WHERE id = p_lead_id;

  RETURN json_build_object(
    'success',true,
    'reservation_id',v_reservation_id,
    'reservation_number',v_res_number,
    'room_type',v_physical_room
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success',false,'error','concurrency','message','Outro processo está confirmando este quarto. Tente novamente.');
  WHEN OTHERS THEN
    RETURN json_build_object('success',false,'error','internal_error','message',SQLERRM);
END;
$$;


-- =============================================================================
-- SETUP COMPLETO ✓
-- Tabelas criadas: leads, conversations, availability, reservations, proposals,
--   payments, followups, ai_logs, daily_metrics, settings, conversation_states,
--   occupancy_history, conversion_funnel_history, scheduled_follow_ups,
--   blackboard_state, luna_config, luna_config_history, rooms, vouchers,
--   competitor_prices, revenue_alerts
-- Seeds: settings (11 linhas), blackboard_state (4 linhas),
--        availability 2026 (1460 linhas), rooms (4 genéricos + 16 individuais)
-- =============================================================================
