-- ============================================================
-- Migration 013: Reservations — channel, notes, checkin_at, checkout_at
-- ============================================================
-- Adiciona campos operacionais à tabela reservations:
--   channel     : canal de origem da reserva (whatsapp, booking, etc.)
--   notes       : observações internas
--   checkin_at  : timestamp real do check-in (operação front-desk)
--   checkout_at : timestamp real do check-out (operação front-desk)
-- NUNCA alterar migrations 001–012 existentes
-- ============================================================

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'booking', 'airbnb', 'direct', 'phone', 'other')),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS checkin_at  timestamptz,
  ADD COLUMN IF NOT EXISTS checkout_at timestamptz;

-- Índice para filtrar por canal no CRM
CREATE INDEX IF NOT EXISTS idx_reservations_channel ON reservations(channel);

-- Comentários descritivos
COMMENT ON COLUMN reservations.channel     IS 'Canal de origem: whatsapp | booking | airbnb | direct | phone | other';
COMMENT ON COLUMN reservations.notes       IS 'Observações internas da equipe';
COMMENT ON COLUMN reservations.checkin_at  IS 'Timestamp real do check-in no front-desk';
COMMENT ON COLUMN reservations.checkout_at IS 'Timestamp real do check-out no front-desk';
