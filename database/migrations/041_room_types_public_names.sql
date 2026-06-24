-- ============================================================================
-- 041_room_types_public_names.sql — Fonte única dos NOMES PÚBLICOS por ala
-- ============================================================================
-- Hoje o nome público da acomodação (mostrado na cotação/reserva e na Luna) está
-- HARDCODED em services/quotation/engine.js (DEFAULT_CONFIG.tipoLabel) e duplicado
-- em calendar.html / landing. Esta tabela centraliza o nome público no nível de
-- ALA (A/B/C) — um único ponto de edição que reflete em todas as telas públicas.
--
-- Distinção preservada:
--   • PÚBLICO/comercial (esta tabela) = por ALA, editável no CRM (rooms.html).
--   • INTERNO/operacional (rooms.name) = por quarto físico (A1–C5), INTOCADO.
--
-- Seed = valores ATUAIS do engine (byte-idêntico): a cotação não muda nada,
-- apenas passa a ler o label daqui. DEFAULT_CONFIG.tipoLabel segue como fallback.
-- Aditivo. NUNCA alterar migrations 001–040.
-- ============================================================================

CREATE TABLE IF NOT EXISTS room_types (
  ala             TEXT        PRIMARY KEY,            -- 'A' | 'B' | 'C'
  room_type_code  TEXT        UNIQUE NOT NULL,        -- 'ALA_A' | 'ALA_B' | 'ALA_C_CASAL'
  public_name     TEXT        NOT NULL,               -- nome comercial mostrado ao hóspede
  subtitle        TEXT,                               -- descritor curto (ex.: "8 chalés")
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  active          BOOLEAN     NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE room_types IS
  'Fonte única do NOME PÚBLICO por ala (A/B/C). Editável no CRM (rooms.html). '
  'Interno por quarto físico fica em rooms.name (intocado).';

-- Seed = strings atuais do engine.js (byte-idêntico) + subtítulos atuais do calendar.
INSERT INTO room_types (ala, room_type_code, public_name, subtitle, sort_order) VALUES
  ('A', 'ALA_A',       'Standard Casal (Ala A)', '8 chalés',   10),
  ('B', 'ALA_B',       'Familia (Ala B)',        '7 bangalôs', 20),
  ('C', 'ALA_C_CASAL', 'Casal Especial (Ala C)', '5 suítes',   30)
ON CONFLICT (ala) DO NOTHING;
