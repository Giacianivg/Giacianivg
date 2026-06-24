-- Migration: 039_is_test_flag
-- Author: Dev (Bloco 1 — Higiene de dados)
-- Date: 2026-06-24
-- Purpose: Marcador is_test para separar dados de teste dos dados reais,
--          mantendo KPIs/relatórios/dashboard críveis.
--
-- Estratégia:
--   - Coluna is_test (default false) nas 8 tabelas que alimentam KPIs/receita/PDV.
--   - test_phone_numbers: lista de telefones de teste (mecanismo "auto").
--   - Triggers BEFORE INSERT: "teste é pegajoso pra baixo" — filho de pai-teste
--     herda is_test=true; NUNCA força false (protege exceções reais).
--   - set_test_by_phone(): usado pelo botão "marcar como teste" do CRM.
--
-- Reversível: enquanto nada é marcado, default false = comportamento atual idêntico.
-- Não altera migrations 001–038. Não toca arquivos protegidos.

BEGIN;

-- =============================================================================
-- 1. Coluna is_test nas 8 tabelas
-- =============================================================================
ALTER TABLE leads               ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reservations        ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE proposals           ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE conversation_states ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE conversations       ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payments            ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE room_charges        ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE counter_tabs        ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

-- Índices parciais: aceleram o filtro padrão "só dados reais" (is_test = false)
CREATE INDEX IF NOT EXISTS idx_leads_real        ON leads(created_at DESC)        WHERE is_test = false;
CREATE INDEX IF NOT EXISTS idx_reservations_real ON reservations(checkin_date)    WHERE is_test = false;
CREATE INDEX IF NOT EXISTS idx_convstates_real   ON conversation_states(state)    WHERE is_test = false;
CREATE INDEX IF NOT EXISTS idx_payments_real     ON payments(created_at DESC)     WHERE is_test = false;
CREATE INDEX IF NOT EXISTS idx_room_charges_real ON room_charges(charged_at DESC) WHERE is_test = false;

-- =============================================================================
-- 2. Lista de telefones de teste (mecanismo "auto")
-- =============================================================================
CREATE TABLE IF NOT EXISTS test_phone_numbers (
  phone      VARCHAR(20)  PRIMARY KEY,
  note       TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE test_phone_numbers IS
  'Telefones (whatsapp_number) tratados como teste: leads desses números nascem is_test=true.';

-- =============================================================================
-- 3. Triggers de marcação automática (BEFORE INSERT)
--    Regra: is_test só é ESCALADO para true. Nunca rebaixado para false.
-- =============================================================================

-- 3a. leads: auto-marca se o telefone estiver na lista de teste
CREATE OR REPLACE FUNCTION mark_lead_is_test()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_test IS NOT TRUE THEN
    NEW.is_test := EXISTS (
      SELECT 1 FROM test_phone_numbers t WHERE t.phone = NEW.whatsapp_number
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_is_test ON leads;
CREATE TRIGGER trg_leads_is_test
  BEFORE INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION mark_lead_is_test();

-- 3b. Filhos do lead (reservations, proposals, conversations, conversation_states):
--     herdam is_test=true se o lead-pai for teste.
CREATE OR REPLACE FUNCTION inherit_is_test_from_lead()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_test IS NOT TRUE AND NEW.lead_id IS NOT NULL THEN
    NEW.is_test := COALESCE(
      (SELECT l.is_test FROM leads l WHERE l.id = NEW.lead_id),
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reservations_is_test ON reservations;
CREATE TRIGGER trg_reservations_is_test
  BEFORE INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION inherit_is_test_from_lead();

DROP TRIGGER IF EXISTS trg_proposals_is_test ON proposals;
CREATE TRIGGER trg_proposals_is_test
  BEFORE INSERT ON proposals
  FOR EACH ROW EXECUTE FUNCTION inherit_is_test_from_lead();

DROP TRIGGER IF EXISTS trg_conversations_is_test ON conversations;
CREATE TRIGGER trg_conversations_is_test
  BEFORE INSERT ON conversations
  FOR EACH ROW EXECUTE FUNCTION inherit_is_test_from_lead();

DROP TRIGGER IF EXISTS trg_convstates_is_test ON conversation_states;
CREATE TRIGGER trg_convstates_is_test
  BEFORE INSERT ON conversation_states
  FOR EACH ROW EXECUTE FUNCTION inherit_is_test_from_lead();

-- 3c. payments e room_charges: herdam da reserva OU da comanda de balcão.
CREATE OR REPLACE FUNCTION inherit_is_test_from_parent_doc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_test IS NOT TRUE THEN
    NEW.is_test :=
      COALESCE((SELECT r.is_test FROM reservations r WHERE r.id = NEW.reservation_id), false)
      OR
      COALESCE((SELECT c.is_test FROM counter_tabs c WHERE c.id = NEW.counter_tab_id), false);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payments_is_test ON payments;
CREATE TRIGGER trg_payments_is_test
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION inherit_is_test_from_parent_doc();

DROP TRIGGER IF EXISTS trg_room_charges_is_test ON room_charges;
CREATE TRIGGER trg_room_charges_is_test
  BEFORE INSERT ON room_charges
  FOR EACH ROW EXECUTE FUNCTION inherit_is_test_from_parent_doc();

-- =============================================================================
-- 4. Função para o botão "marcar como teste" do CRM (marca lead + cascateia)
--    ATENÇÃO: NÃO use em leads que possuam reservas reais fixadas (ex.: o grupo
--    real sob o lead "jaine"). A cascata escreveria is_test no(s) filho(s).
-- =============================================================================
CREATE OR REPLACE FUNCTION set_test_by_phone(p_phone VARCHAR, p_is_test BOOLEAN)
RETURNS void AS $$
DECLARE
  v_lead_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO v_lead_ids FROM leads WHERE whatsapp_number = p_phone;
  IF v_lead_ids IS NULL THEN
    RETURN;
  END IF;

  UPDATE leads               SET is_test = p_is_test WHERE id = ANY(v_lead_ids);
  UPDATE reservations        SET is_test = p_is_test WHERE lead_id = ANY(v_lead_ids);
  UPDATE proposals           SET is_test = p_is_test WHERE lead_id = ANY(v_lead_ids);
  UPDATE conversations       SET is_test = p_is_test WHERE lead_id = ANY(v_lead_ids);
  UPDATE conversation_states SET is_test = p_is_test WHERE lead_id = ANY(v_lead_ids);
  UPDATE payments    SET is_test = p_is_test
    WHERE reservation_id IN (SELECT id FROM reservations WHERE lead_id = ANY(v_lead_ids));
  UPDATE room_charges SET is_test = p_is_test
    WHERE reservation_id IN (SELECT id FROM reservations WHERE lead_id = ANY(v_lead_ids));
END;
$$ LANGUAGE plpgsql;

COMMIT;
