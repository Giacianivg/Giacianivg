-- ============================================================================
-- 017_baseline.sql — Snapshot completo do schema de produção
-- ============================================================================
-- Gerado em 2026-06-10 a partir do projeto Supabase nqxesjxbqupmhnivkfyk
-- (canônico, confirmado na Vercel em produção).
--
-- PROPÓSITO: baseline para provisionar AMBIENTES NOVOS (staging, tenant 2,
-- ambiente local). A produção JÁ CONTÉM este schema — não executar lá.
-- O script é idempotente (IF NOT EXISTS / OR REPLACE) como proteção extra.
--
-- Conteúdo: 23 tabelas, 1 enum, 3 sequences, 10 funções, 10 triggers,
-- 8 views, RLS + 21 policies.
-- Inclui o fix de RLS aplicado em 2026-06-10 (migration remota
-- enable_rls_remaining_tables).
-- ============================================================================

-- ─── 1. ENUM ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE conversation_state AS ENUM (
    'GREETING', 'COLLECT_NAME', 'ASK_DATES', 'ASK_GUESTS',
    'SHOW_ROOMS', 'SEND_QUOTE', 'CONFIRM_BOOKING', 'HANDOFF_HUMAN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. SEQUENCES ───────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS seq_reservations;
CREATE SEQUENCE IF NOT EXISTS seq_proposals;

-- ─── 3. FUNÇÕES BASE (usadas como DEFAULT de colunas) ──────────────────────

CREATE OR REPLACE FUNCTION public.generate_reservation_number()
RETURNS text LANGUAGE plpgsql AS $function$
BEGIN
  RETURN 'RES-' || to_char(NOW(), 'YYYY') || '-' ||
         lpad(nextval('seq_reservations')::TEXT, 5, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_proposal_number()
RETURNS text LANGUAGE plpgsql AS $function$
BEGIN
  RETURN 'PROP-' || to_char(NOW(), 'YYYY') || '-' ||
         lpad(nextval('seq_proposals')::TEXT, 5, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_conversation_states_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$;

-- ─── 4. TABELAS (ordem de dependência) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number     varchar(20) NOT NULL UNIQUE,
  name                varchar(150),
  email               varchar(150),
  lead_source         varchar(50) DEFAULT 'whatsapp',
  funnel_stage        varchar(30) NOT NULL DEFAULT 'new',
  qualification_score smallint DEFAULT 0,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz,
  score               integer DEFAULT 0,
  score_label         text DEFAULT 'cold',
  score_updated_at    timestamptz,
  alert_type          text,
  alert_message       text,
  alert_updated_at    timestamptz,
  CONSTRAINT leads_funnel_check CHECK (funnel_stage::text = ANY (ARRAY['new','qualified','proposal','negotiation','confirmed','lost']::text[])),
  CONSTRAINT leads_whatsapp_fmt CHECK (whatsapp_number::text ~ '^\d{10,15}$')
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  whatsapp_number varchar(20) NOT NULL,
  role            varchar(10) NOT NULL,
  content         text NOT NULL,
  extracted_data  jsonb,
  token_usage     jsonb,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT conversations_role_check CHECK (role::text = ANY (ARRAY['user','assistant']::text[]))
);

CREATE TABLE IF NOT EXISTS public.conversation_states (
  lead_id    uuid PRIMARY KEY,
  phone      varchar(20) NOT NULL UNIQUE,
  state      conversation_state NOT NULL DEFAULT 'GREETING',
  data       jsonb NOT NULL DEFAULT '{}',
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP + interval '24 hours'),
  CONSTRAINT fk_conversation_states_lead_id FOREIGN KEY (lead_id) REFERENCES leads(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT expires_in_future CHECK (expires_at > created_at),
  CONSTRAINT phone_format CHECK (phone::text ~ '^\+?55\d{9,11}$' OR phone::text ~ '^\d{10,11}$'),
  CONSTRAINT valid_state_choice CHECK (state = ANY (ARRAY['GREETING','COLLECT_NAME','ASK_DATES','ASK_GUESTS','SHOW_ROOMS','SEND_QUOTE','CONFIRM_BOOKING','HANDOFF_HUMAN']::conversation_state[]))
);

COMMENT ON TABLE public.conversation_states IS 'Persistent conversation state machine per guest (phone). Single source of truth for conversation progress. TTL = 24h. Enables deterministic 7-state funnel control.';

CREATE TABLE IF NOT EXISTS public.reservations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number text NOT NULL UNIQUE DEFAULT generate_reservation_number(),
  lead_id            uuid NOT NULL REFERENCES leads(id),
  whatsapp_number    varchar(20) NOT NULL,
  room_type          varchar(20) NOT NULL,
  checkin_date       date NOT NULL,
  checkout_date      date NOT NULL,
  guests             smallint NOT NULL,
  total_amount       numeric(10,2) NOT NULL,
  deposit_amount     numeric(10,2) NOT NULL,
  balance_amount     numeric(10,2) GENERATED ALWAYS AS (total_amount - deposit_amount) STORED,
  status             varchar(30) NOT NULL DEFAULT 'pending',
  payment_method     varchar(30),
  guest_notes        text,
  internal_notes     text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  cancelled_at       timestamptz,
  channel            text DEFAULT 'whatsapp',
  notes              text,
  checkin_at         timestamptz,
  checkout_at        timestamptz,
  CONSTRAINT fk_res_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT,
  CONSTRAINT res_dates_check CHECK (checkout_date > checkin_date),
  CONSTRAINT res_room_check CHECK (room_type::text = ANY (ARRAY['ALA_A','ALA_B','ALA_C_1','ALA_C_2']::text[])),
  CONSTRAINT res_status_check CHECK (status::text = ANY (ARRAY['pending','deposit_paid','confirmed','checked_in','completed','cancelled']::text[])),
  CONSTRAINT reservations_channel_check CHECK (channel = ANY (ARRAY['whatsapp','booking','airbnb','direct','phone','other'])),
  CONSTRAINT reservations_deposit_amount_check CHECK (deposit_amount > 0),
  CONSTRAINT reservations_guests_check CHECK (guests > 0),
  CONSTRAINT reservations_total_amount_check CHECK (total_amount > 0)
);

CREATE TABLE IF NOT EXISTS public.availability (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type      varchar(20) NOT NULL,
  date           date NOT NULL,
  status         varchar(20) NOT NULL DEFAULT 'available',
  reservation_id uuid,
  block_reason   text,
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT availability_room_type_date_key UNIQUE (room_type, date),
  CONSTRAINT fk_avail_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  CONSTRAINT avail_room_check CHECK (room_type::text = ANY (ARRAY['ALA_A','ALA_B','ALA_C_1','ALA_C_2']::text[])),
  CONSTRAINT avail_status_check CHECK (status::text = ANY (ARRAY['available','reserved','blocked']::text[]))
);

CREATE TABLE IF NOT EXISTS public.proposals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number text NOT NULL UNIQUE DEFAULT generate_proposal_number(),
  lead_id         uuid NOT NULL REFERENCES leads(id),
  whatsapp_number varchar(20) NOT NULL,
  room_type       varchar(20) NOT NULL,
  checkin_date    date NOT NULL,
  checkout_date   date NOT NULL,
  guests          smallint NOT NULL,
  nights          smallint NOT NULL GENERATED ALWAYS AS (checkout_date - checkin_date) STORED,
  gross_amount    numeric(10,2) NOT NULL,
  discount_pct    smallint DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  final_amount    numeric(10,2) NOT NULL,
  deposit_amount  numeric(10,2) NOT NULL,
  breakdown       jsonb,
  status          varchar(20) NOT NULL DEFAULT 'sent',
  validity_days   smallint DEFAULT 7,
  reservation_id  uuid REFERENCES reservations(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  CONSTRAINT fk_prop_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT,
  CONSTRAINT prop_status_check CHECK (status::text = ANY (ARRAY['sent','viewed','accepted','rejected','expired']::text[])),
  CONSTRAINT proposals_final_amount_check CHECK (final_amount > 0)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  uuid NOT NULL REFERENCES reservations(id),
  payment_type    varchar(20) NOT NULL,
  amount          numeric(10,2) NOT NULL,
  method          varchar(20) NOT NULL DEFAULT 'pix',
  status          varchar(20) NOT NULL DEFAULT 'pending',
  external_id     varchar(100),
  qr_code_url     text,
  pix_copy_paste  text,
  expires_at      timestamptz,
  confirmed_at    timestamptz,
  webhook_payload jsonb,
  error_message   text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  CONSTRAINT fk_pay_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE RESTRICT,
  CONSTRAINT payments_amount_check CHECK (amount > 0),
  CONSTRAINT payments_method_check CHECK (method::text = ANY (ARRAY['pix','card','cash','transfer']::text[])),
  CONSTRAINT payments_payment_type_check CHECK (payment_type::text = ANY (ARRAY['deposit','balance','full']::text[])),
  CONSTRAINT payments_status_check CHECK (status::text = ANY (ARRAY['pending','processing','confirmed','failed','refunded']::text[]))
);

CREATE TABLE IF NOT EXISTS public.followups (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  whatsapp_number  varchar(20) NOT NULL,
  followup_type    varchar(50) NOT NULL,
  status           varchar(20) NOT NULL DEFAULT 'scheduled',
  scheduled_for    timestamptz NOT NULL,
  sent_at          timestamptz,
  message_template text,
  lead_reply       text,
  replied_at       timestamptz,
  attempts         smallint DEFAULT 0,
  next_attempt_at  timestamptz,
  created_at       timestamptz DEFAULT now(),
  CONSTRAINT followups_status_check CHECK (status::text = ANY (ARRAY['scheduled','sent','replied','cancelled','failed']::text[]))
);

CREATE TABLE IF NOT EXISTS public.scheduled_follow_ups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid REFERENCES leads(id) ON DELETE CASCADE,
  phone          text NOT NULL,
  follow_up_type text NOT NULL,
  scheduled_for  timestamptz NOT NULL,
  sent_at        timestamptz,
  status         text NOT NULL DEFAULT 'pending',
  template_name  text NOT NULL,
  metadata       jsonb DEFAULT '{}',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid REFERENCES leads(id),
  whatsapp_number varchar(20),
  model           varchar(60) NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  input_tokens    integer,
  output_tokens   integer,
  latency_ms      integer,
  cost_usd        numeric(10,6),
  status          varchar(20) DEFAULT 'success',
  error_message   text,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT ai_logs_status_check CHECK (status::text = ANY (ARRAY['success','error','timeout']::text[]))
);

CREATE TABLE IF NOT EXISTS public.daily_metrics (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                     date NOT NULL UNIQUE,
  new_leads                integer DEFAULT 0,
  qualified_leads          integer DEFAULT 0,
  proposals_sent           integer DEFAULT 0,
  proposals_accepted       integer DEFAULT 0,
  reservations_confirmed   integer DEFAULT 0,
  lead_conversion_rate     numeric(5,2),
  proposal_conversion_rate numeric(5,2),
  revenue_day              numeric(12,2) DEFAULT 0,
  rooms_occupied           smallint DEFAULT 0,
  ai_cost_usd              numeric(8,4) DEFAULT 0,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         varchar(100) NOT NULL UNIQUE,
  value       text,
  value_type  varchar(20),
  description text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT settings_value_type_check CHECK (value_type::text = ANY (ARRAY['string','number','boolean','json']::text[]))
);

CREATE TABLE IF NOT EXISTS public.occupancy_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date              date NOT NULL,
  room_type         varchar(20) NOT NULL,
  total_units       smallint NOT NULL,
  occupied_units    smallint NOT NULL DEFAULT 0,
  occupancy_rate    numeric(3,2) GENERATED ALWAYS AS (
                      CASE WHEN total_units = 0 THEN NULL
                           ELSE round(occupied_units::numeric / total_units::numeric, 2)
                      END) STORED,
  price_charged     numeric(10,2),
  revenue_generated numeric(12,2),
  season            varchar(20),
  day_of_week       varchar(10),
  demand_indicator  varchar(20) DEFAULT 'normal',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  CONSTRAINT occupancy_history_date_room_type_key UNIQUE (date, room_type),
  CONSTRAINT occupancy_history_check CHECK (occupied_units >= 0 AND occupied_units <= total_units),
  CONSTRAINT occupancy_history_date_check CHECK (date <= CURRENT_DATE),
  CONSTRAINT occupancy_history_day_of_week_check CHECK (day_of_week IS NULL OR day_of_week::text = ANY (ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']::text[])),
  CONSTRAINT occupancy_history_demand_indicator_check CHECK (demand_indicator::text = ANY (ARRAY['low','normal','high','peak']::text[])),
  CONSTRAINT occupancy_history_revenue_generated_check CHECK (revenue_generated >= 0),
  CONSTRAINT occupancy_history_season_check CHECK (season IS NULL OR season::text = ANY (ARRAY['baixa','media','alta','holiday']::text[])),
  CONSTRAINT occupancy_history_total_units_check CHECK (total_units > 0)
);

CREATE TABLE IF NOT EXISTS public.conversion_funnel_history (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                       date NOT NULL UNIQUE,
  leads_new                  integer DEFAULT 0 CHECK (leads_new >= 0),
  leads_qualified            integer DEFAULT 0 CHECK (leads_qualified >= 0),
  leads_proposal_sent        integer DEFAULT 0 CHECK (leads_proposal_sent >= 0),
  leads_confirmed            integer DEFAULT 0 CHECK (leads_confirmed >= 0),
  leads_lost                 integer DEFAULT 0 CHECK (leads_lost >= 0),
  conv_new_to_qualified      numeric(5,2) CHECK (conv_new_to_qualified IS NULL OR (conv_new_to_qualified >= 0 AND conv_new_to_qualified <= 100)),
  conv_qualified_to_proposal numeric(5,2) CHECK (conv_qualified_to_proposal IS NULL OR (conv_qualified_to_proposal >= 0 AND conv_qualified_to_proposal <= 100)),
  conv_proposal_to_confirmed numeric(5,2) CHECK (conv_proposal_to_confirmed IS NULL OR (conv_proposal_to_confirmed >= 0 AND conv_proposal_to_confirmed <= 100)),
  overall_conversion         numeric(5,2) CHECK (overall_conversion IS NULL OR (overall_conversion >= 0 AND overall_conversion <= 100)),
  revenue_day                numeric(12,2) DEFAULT 0 CHECK (revenue_day >= 0),
  avg_booking_value          numeric(10,2) CHECK (avg_booking_value IS NULL OR avg_booking_value >= 0),
  created_at                 timestamptz DEFAULT now(),
  updated_at                 timestamptz DEFAULT now(),
  CONSTRAINT conversion_funnel_history_date_check CHECK (date <= CURRENT_DATE)
);

CREATE TABLE IF NOT EXISTS public.blackboard_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.luna_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt   text NOT NULL DEFAULT '',
  personality     jsonb NOT NULL DEFAULT '{"tom": "acolhedor", "nome": "Luna", "emoji": true}',
  scripts         jsonb NOT NULL DEFAULT '{"cotacao": "", "objecao": "", "saudacao": "", "fechamento": ""}',
  active_packages jsonb NOT NULL DEFAULT '[]',
  version         integer NOT NULL DEFAULT 1,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS public.luna_config_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt   text NOT NULL DEFAULT '',
  personality     jsonb NOT NULL DEFAULT '{}',
  scripts         jsonb NOT NULL DEFAULT '{}',
  active_packages jsonb NOT NULL DEFAULT '[]',
  version         integer NOT NULL,
  saved_at        timestamptz NOT NULL DEFAULT now(),
  saved_by        text NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL UNIQUE,
  availability_codes jsonb NOT NULL DEFAULT '[]',
  name               text NOT NULL,
  description        text NOT NULL DEFAULT '',
  max_guests         integer NOT NULL DEFAULT 2,
  base_price_baixa   numeric(10,2) NOT NULL DEFAULT 300.00,
  base_price_media   numeric(10,2) NOT NULL DEFAULT 300.00,
  base_price_alta    numeric(10,2) NOT NULL DEFAULT 400.00,
  amenities          jsonb NOT NULL DEFAULT '[]',
  active             boolean NOT NULL DEFAULT true,
  sort_order         integer NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vouchers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  guest_name     text NOT NULL,
  room_type      text NOT NULL,
  check_in       date NOT NULL,
  check_out      date NOT NULL,
  guests         integer NOT NULL DEFAULT 1,
  source         text NOT NULL DEFAULT 'direct',
  total_amount   numeric(10,2),
  download_token uuid NOT NULL DEFAULT gen_random_uuid(),
  status         text NOT NULL DEFAULT 'active',
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vouchers_source_check CHECK (source = ANY (ARRAY['direct','booking','expedia','whatsapp'])),
  CONSTRAINT vouchers_status_check CHECK (status = ANY (ARRAY['active','cancelled']))
);

CREATE TABLE IF NOT EXISTS public.competitor_prices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name text NOT NULL,
  competitor_url  text,
  platform        text DEFAULT 'booking',
  date            date NOT NULL,
  price           numeric(10,2),
  room_type       text,
  availability    boolean DEFAULT true,
  scraped_at      timestamptz DEFAULT now(),
  source          text DEFAULT 'apify',
  CONSTRAINT competitor_prices_platform_check CHECK (platform = ANY (ARRAY['booking','airbnb','direct'])),
  CONSTRAINT competitor_prices_room_type_check CHECK (room_type = ANY (ARRAY['standard','casal','familia','grupo'])),
  CONSTRAINT competitor_prices_source_check CHECK (source = ANY (ARRAY['apify','manual']))
);

COMMENT ON TABLE public.competitor_prices IS 'Preços de pousadas concorrentes por data. Fonte: Apify (automático) ou entrada manual.';

CREATE TABLE IF NOT EXISTS public.revenue_alerts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  urgency    text DEFAULT 'medium',
  message    text NOT NULL,
  data       jsonb,
  date_ref   date,
  room_type  text,
  dismissed  boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT revenue_alerts_alert_type_check CHECK (alert_type = ANY (ARRAY['you_expensive','you_cheap_opportunity','competitor_price_drop','competitor_price_surge','high_demand_signal','low_season_warning'])),
  CONSTRAINT revenue_alerts_urgency_check CHECK (urgency = ANY (ARRAY['high','medium','low','info']))
);

COMMENT ON TABLE public.revenue_alerts IS 'Alertas de revenue intelligence gerados por Maxwell (@revenue-agent). Leitura: GET /api/alerts/revenue.';

-- Tabela embrionária — candidata a virar `tenants` na Fase 2 (multi-tenancy)
CREATE TABLE IF NOT EXISTS public.pousada (
  id         bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. ÍNDICES ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ailogs_created ON public.ai_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ailogs_lead ON public.ai_logs (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_avail_date ON public.availability (date);
CREATE INDEX IF NOT EXISTS idx_avail_room_date ON public.availability (room_type, date);
CREATE INDEX IF NOT EXISTS idx_avail_status_date ON public.availability (status, date);
CREATE INDEX IF NOT EXISTS idx_cp_competitor_date ON public.competitor_prices (competitor_name, date);
CREATE INDEX IF NOT EXISTS idx_cp_date ON public.competitor_prices (date);
CREATE INDEX IF NOT EXISTS idx_cp_platform ON public.competitor_prices (platform);
CREATE INDEX IF NOT EXISTS idx_conversation_states_created_at ON public.conversation_states (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_states_expires_at ON public.conversation_states (expires_at) WHERE state <> 'HANDOFF_HUMAN';
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_states_phone ON public.conversation_states (phone);
CREATE INDEX IF NOT EXISTS idx_conversation_states_state ON public.conversation_states (state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON public.conversations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON public.conversations (lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_number ON public.conversations (whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_conv_created ON public.conversion_funnel_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_date ON public.conversion_funnel_history (date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON public.daily_metrics (date DESC);
CREATE INDEX IF NOT EXISTS idx_followup_lead ON public.followups (lead_id);
CREATE INDEX IF NOT EXISTS idx_followup_scheduled ON public.followups (scheduled_for) WHERE status::text = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_leads_alert_type ON public.leads (alert_type) WHERE alert_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads (score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads (funnel_stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON public.leads (whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_luna_history_version ON public.luna_config_history (version DESC);
CREATE INDEX IF NOT EXISTS idx_occupancy_date ON public.occupancy_history (date DESC);
CREATE INDEX IF NOT EXISTS idx_occupancy_demand ON public.occupancy_history (demand_indicator, date DESC);
CREATE INDEX IF NOT EXISTS idx_occupancy_room_date ON public.occupancy_history (room_type, date DESC);
CREATE INDEX IF NOT EXISTS idx_occupancy_season ON public.occupancy_history (season, date DESC);
CREATE INDEX IF NOT EXISTS idx_pay_external ON public.payments (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pay_reservation ON public.payments (reservation_id);
CREATE INDEX IF NOT EXISTS idx_pay_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_pending ON public.payments (created_at DESC) WHERE status::text = ANY (ARRAY['pending','processing']::text[]);
CREATE INDEX IF NOT EXISTS idx_prop_created ON public.proposals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prop_lead ON public.proposals (lead_id);
CREATE INDEX IF NOT EXISTS idx_prop_number ON public.proposals (proposal_number);
CREATE INDEX IF NOT EXISTS idx_prop_status ON public.proposals (status);
CREATE INDEX IF NOT EXISTS idx_proposals_expiry ON public.proposals (status, created_at DESC) WHERE status::text = ANY (ARRAY['sent','viewed']::text[]);
CREATE INDEX IF NOT EXISTS idx_res_checkin ON public.reservations (checkin_date);
CREATE INDEX IF NOT EXISTS idx_res_lead ON public.reservations (lead_id);
CREATE INDEX IF NOT EXISTS idx_res_number ON public.reservations (whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_res_res_num ON public.reservations (reservation_number);
CREATE INDEX IF NOT EXISTS idx_res_status ON public.reservations (status);
CREATE INDEX IF NOT EXISTS idx_reservations_active_occupancy ON public.reservations (checkin_date, checkout_date) WHERE status::text = ANY (ARRAY['confirmed','checked_in','completed']::text[]);
CREATE INDEX IF NOT EXISTS idx_reservations_channel ON public.reservations (channel);
CREATE INDEX IF NOT EXISTS idx_ra_created_at ON public.revenue_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ra_date_ref ON public.revenue_alerts (date_ref);
CREATE INDEX IF NOT EXISTS idx_ra_dismissed ON public.revenue_alerts (dismissed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ra_urgency ON public.revenue_alerts (urgency) WHERE dismissed = false;
CREATE INDEX IF NOT EXISTS idx_rooms_active ON public.rooms (active, sort_order);
CREATE INDEX IF NOT EXISTS idx_sfu_lead ON public.scheduled_follow_ups (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sfu_pending ON public.scheduled_follow_ups (scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_vouchers_check_in ON public.vouchers (check_in);
CREATE INDEX IF NOT EXISTS idx_vouchers_download_token ON public.vouchers (download_token);
CREATE INDEX IF NOT EXISTS idx_vouchers_guest_name ON public.vouchers (lower(guest_name));
CREATE INDEX IF NOT EXISTS idx_vouchers_source ON public.vouchers (source);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers (status);

-- ─── 6. FUNÇÕES DE NEGÓCIO ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_release_on_cancel()
RETURNS trigger LANGUAGE plpgsql AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_reservation_atomic(p_lead_id uuid, p_whatsapp character varying, p_room_type character varying, p_checkin date, p_checkout date, p_guests smallint, p_total_amount numeric, p_deposit_amount numeric, p_proposal_id uuid DEFAULT NULL::uuid)
RETURNS json LANGUAGE plpgsql AS $function$
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

  -- CTE bloqueia rows individualmente (FOR UPDATE), COUNT() no resultado
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
$function$;

CREATE OR REPLACE FUNCTION public.initialize_calendar(p_start date, p_end date)
RETURNS integer LANGUAGE plpgsql AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.populate_conversion_funnel(p_date date)
RETURNS boolean LANGUAGE plpgsql AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.populate_occupancy_history(p_date date)
RETURNS integer LANGUAGE plpgsql AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.release_reservation(p_reservation_id uuid, p_reason text DEFAULT 'cancelled'::text)
RETURNS json LANGUAGE plpgsql AS $function$
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
$function$;

-- ─── 7. TRIGGERS ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_leads_updated ON public.leads;
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_reservations_updated ON public.reservations;
CREATE TRIGGER trg_reservations_updated BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_proposals_updated ON public.proposals;
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated ON public.payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_metrics_updated ON public.daily_metrics;
CREATE TRIGGER trg_metrics_updated BEFORE UPDATE ON public.daily_metrics FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated ON public.settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS tr_conversation_states_updated_at ON public.conversation_states;
CREATE TRIGGER tr_conversation_states_updated_at BEFORE UPDATE ON public.conversation_states FOR EACH ROW EXECUTE FUNCTION update_conversation_states_updated_at();

DROP TRIGGER IF EXISTS trg_auto_release_cancelled ON public.reservations;
CREATE TRIGGER trg_auto_release_cancelled AFTER UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION auto_release_on_cancel();

DROP TRIGGER IF EXISTS trg_occupancy_updated ON public.occupancy_history;
CREATE TRIGGER trg_occupancy_updated BEFORE UPDATE ON public.occupancy_history FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_conv_updated ON public.conversion_funnel_history;
CREATE TRIGGER trg_conv_updated BEFORE UPDATE ON public.conversion_funnel_history FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ─── 8. VIEWS ───────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_active_leads AS
SELECT id, whatsapp_number, name, email, lead_source, funnel_stage,
       qualification_score, notes, created_at, updated_at, deleted_at
FROM leads
WHERE deleted_at IS NULL AND funnel_stage::text <> 'lost';

CREATE OR REPLACE VIEW public.vw_occupancy_calendar AS
SELECT a.date, a.room_type, a.status, r.reservation_number, r.guests,
       l.name AS guest_name, l.whatsapp_number
FROM availability a
LEFT JOIN reservations r ON r.id = a.reservation_id
LEFT JOIN leads l ON l.id = r.lead_id
ORDER BY a.date, a.room_type;

CREATE OR REPLACE VIEW public.vw_revenue AS
SELECT count(*) AS total_reservations,
       COALESCE(sum(CASE WHEN status::text = ANY (ARRAY['confirmed','checked_in','completed']::text[]) THEN total_amount ELSE 0 END), 0) AS confirmed_revenue,
       COALESCE(sum(CASE WHEN status::text = 'pending' THEN total_amount ELSE 0 END), 0) AS pending_revenue,
       COALESCE(sum(CASE WHEN status::text = ANY (ARRAY['confirmed','checked_in','completed']::text[]) THEN deposit_amount ELSE 0 END), 0) AS deposits_received
FROM reservations
WHERE status::text <> 'cancelled';

CREATE OR REPLACE VIEW public.vw_urgent_proposals AS
SELECT p.proposal_number, p.created_at, p.final_amount, p.checkin_date, p.checkout_date,
       l.name AS lead_name, l.whatsapp_number,
       EXTRACT(epoch FROM (now() - p.created_at)) / 3600 AS hours_without_reply
FROM proposals p
JOIN leads l ON l.id = p.lead_id
WHERE p.status::text = 'sent' AND p.created_at < (now() - interval '48 hours')
ORDER BY p.created_at;

CREATE OR REPLACE VIEW public.vw_occupancy_trends AS
SELECT date, room_type, occupancy_rate, price_charged, revenue_generated, season, demand_indicator,
       avg(occupancy_rate) OVER (PARTITION BY room_type ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS occupancy_rate_7d_avg
FROM occupancy_history
ORDER BY date DESC, room_type;

CREATE OR REPLACE VIEW public.vw_funnel_trends AS
SELECT date, leads_new, leads_qualified, leads_proposal_sent, leads_confirmed, leads_lost,
       overall_conversion, revenue_day,
       avg(overall_conversion) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS conversion_7d_avg,
       lag(overall_conversion) OVER (ORDER BY date) AS prior_day_conversion
FROM conversion_funnel_history
ORDER BY date DESC;

CREATE OR REPLACE VIEW public.vw_seasonality_analysis AS
SELECT season, count(*) AS days_in_season,
       avg(occupancy_rate) AS avg_occupancy,
       max(occupancy_rate) AS peak_occupancy,
       min(occupancy_rate) AS low_occupancy,
       avg(price_charged) AS avg_price,
       sum(revenue_generated) AS total_revenue,
       avg(revenue_generated) AS avg_daily_revenue
FROM occupancy_history
WHERE season IS NOT NULL
GROUP BY season
ORDER BY avg(occupancy_rate) DESC;

CREATE OR REPLACE VIEW public.vw_room_performance AS
SELECT room_type, count(*) AS days_tracked,
       avg(occupancy_rate) AS avg_occupancy,
       sum(revenue_generated) AS total_revenue,
       avg(price_charged) AS avg_nightly_rate,
       sum(occupied_units) AS total_nights_occupied,
       round(sum(revenue_generated) / NULLIF(sum(occupied_units), 0)::numeric, 2) AS adr,
       round(sum(revenue_generated) / NULLIF(count(*), 0)::numeric, 2) AS revpar
FROM occupancy_history
GROUP BY room_type
ORDER BY sum(revenue_generated) DESC;

-- ─── 9. RLS + POLICIES ──────────────────────────────────────────────────────
-- Padrão atual (single-tenant): authenticated = acesso total via dashboard;
-- service_role (supabaseAdmin) ignora RLS. A anon key não tem acesso a nada.
-- Na Fase 2 (multi-tenant) estas policies serão refinadas por tenant_id.

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupancy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_funnel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blackboard_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.luna_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.luna_config_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pousada ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY manager_leads ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_conversations ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY service_internal_access ON public.conversation_states FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_reservations ON public.reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_availability ON public.availability FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_proposals ON public.proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_payments ON public.payments FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_followups ON public.followups FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY sfu_authenticated_all ON public.scheduled_follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_ai_logs ON public.ai_logs FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_metrics ON public.daily_metrics FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_settings ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY occupancy_authenticated_all ON public.occupancy_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY conv_authenticated_all ON public.conversion_funnel_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY service_internal_blackboard ON public.blackboard_state FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_luna_config ON public.luna_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_luna_config_history ON public.luna_config_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_rooms ON public.rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_vouchers ON public.vouchers FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_competitor_prices ON public.competitor_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY manager_revenue_alerts ON public.revenue_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- pousada: RLS habilitada sem policy (tabela vazia, reservada para Fase 2)
