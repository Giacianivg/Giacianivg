-- Migration 009: Rooms — metadados dos quartos da pousada
-- DEC-010 aprovado 2026-03-10
-- NUNCA alterar migrations 001–008 existentes

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

-- Seed: 4 quartos reais da pousada (safe to re-run via ON CONFLICT DO NOTHING)
INSERT INTO rooms (code, availability_codes, name, description, max_guests,
                   base_price_baixa, base_price_media, base_price_alta,
                   amenities, sort_order)
VALUES
  (
    'ALA_A',
    '["ALA_A"]',
    'Ala A',
    'Quarto aconchegante ideal para casais ou pequenos grupos. Vista para o jardim, cama queen size e varanda privativa.',
    3,
    300.00, 300.00, 400.00,
    '["Ar-condicionado","Wi-Fi","TV 32\"","Frigobar","Varanda","Cama queen size"]',
    1
  ),
  (
    'ALA_B',
    '["ALA_B"]',
    'Ala B',
    'Quarto espaçoso para familias. Duas camas de casal e sala de estar integrada com vista para a piscina.',
    5,
    300.00, 350.00, 400.00,
    '["Ar-condicionado","Wi-Fi","TV 42\"","Frigobar","Sala de estar","Vista piscina","2 camas de casal"]',
    2
  ),
  (
    'ALA_C_CASAL',
    '["ALA_C_1","ALA_C_2"]',
    'Ala C — Casal',
    'Suite premium para grupos maiores. Dois quartos interligados com sala comum, perfeita para familias grandes ou grupos de amigos.',
    8,
    300.00, 300.00, 400.00,
    '["Ar-condicionado","Wi-Fi","TV 42\"","Frigobar","Sala comum","2 banheiros","Varanda ampla","Churrasqueira privativa"]',
    3
  ),
  (
    'ALA_C_GRUPO',
    '[]',
    'Ala C — Grupo',
    'Espaco exclusivo para grupos grandes. Configuracao personalizada mediante consulta com a equipe. Disponibilidade e valores sob cotacao.',
    99,
    150.00, 150.00, 150.00,
    '["Espaco exclusivo","Configuracao personalizada","Churrasqueira","Piscina privativa","Atendimento VIP"]',
    4
  )
ON CONFLICT (code) DO NOTHING;
