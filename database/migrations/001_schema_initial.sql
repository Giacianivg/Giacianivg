-- =============================================================================
-- Migration: 001_schema_initial.sql
-- PLU-06.1: Supabase Schema — Pousada Luz da Lua
--
-- ATENÇÃO: Dropa e recria tudo do zero.
-- Seguro para setup inicial (sem dados reais ainda).
-- =============================================================================

-- ─── DROP tudo (ordem inversa de dependência) ─────────────────────────────────
DROP VIEW IF EXISTS vw_urgent_proposals    CASCADE;
DROP VIEW IF EXISTS vw_revenue             CASCADE;
DROP VIEW IF EXISTS vw_occupancy_calendar  CASCADE;
DROP VIEW IF EXISTS vw_active_leads        CASCADE;

DROP TABLE IF EXISTS ai_logs       CASCADE;
DROP TABLE IF EXISTS daily_metrics CASCADE;
DROP TABLE IF EXISTS followups     CASCADE;
DROP TABLE IF EXISTS payments      CASCADE;
DROP TABLE IF EXISTS proposals     CASCADE;
DROP TABLE IF EXISTS reservations  CASCADE;
DROP TABLE IF EXISTS availability  CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS leads         CASCADE;
DROP TABLE IF EXISTS settings      CASCADE;

DROP FUNCTION IF EXISTS release_reservation(UUID, TEXT)                                                           CASCADE;
DROP FUNCTION IF EXISTS create_reservation_atomic(UUID, VARCHAR, VARCHAR, DATE, DATE, SMALLINT, DECIMAL, DECIMAL, UUID) CASCADE;
DROP FUNCTION IF EXISTS initialize_calendar(DATE, DATE)                                                           CASCADE;
DROP FUNCTION IF EXISTS generate_reservation_number()                                                             CASCADE;
DROP FUNCTION IF EXISTS generate_proposal_number()                                                                CASCADE;
DROP FUNCTION IF EXISTS touch_updated_at()                                                                        CASCADE;

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
-- RPC: create_reservation_atomic
-- =============================================================================

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

  SELECT COUNT(*) INTO v_nights_free
  FROM availability
  WHERE room_type = v_physical_room
    AND date >= p_checkin AND date < p_checkout
    AND status = 'available'
  FOR UPDATE NOWAIT;

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

-- =============================================================================
-- Inicializar calendário 2026-2027
-- (executado pelo 002_calendar_seed.sql)
-- =============================================================================
