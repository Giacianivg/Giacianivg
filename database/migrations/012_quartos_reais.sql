-- ============================================================
-- Migration 012: Quartos individuais reais — Pousada Luz da Lua
-- ============================================================
-- Ala A · Vista para o Pomar
--   A1–A3  : Casal + 1 Solteiro  (max 3 hóspedes)
--   A4–A8  : Casal + 2 Solteiros (max 4 hóspedes)
-- Ala B · Vista para a Montanha
--   B1     : Casal + 1 Solteiro  (max 3 hóspedes)
--   B2–B7  : Casal + 4 Solteiros (max 6 hóspedes)
-- Ala C · Quarto do Campo
--   C1–C2  : Grupo (max 8 hóspedes)
--   C3–C5  : Casal             (max 2 hóspedes)
-- NUNCA alterar migrations 001–011 existentes
-- ============================================================

-- ── Desativa registros genéricos (mantém histórico) ──────────
UPDATE rooms
   SET active = false
 WHERE code IN ('ALA_A', 'ALA_B', 'ALA_C_CASAL', 'ALA_C_GRUPO');


-- ════════════════════════════════════════════════════════════
-- ALA A — Vista para o Pomar
-- ════════════════════════════════════════════════════════════

-- A1–A3 · Casal + 1 Solteiro · max 3 hóspedes
INSERT INTO rooms (
  code, availability_codes, name, description, max_guests,
  base_price_baixa, base_price_media, base_price_alta,
  amenities, sort_order
) VALUES
  (
    'A1', '["A1"]',
    'Quarto A1 — Vista Pomar',
    'Quarto com vista para o pomar, 1 cama de casal e 1 cama de solteiro, varanda com rede.',
    3,
    280.00, 280.00, 400.00,
    '["Cama de casal","Cama de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',
    10
  ),
  (
    'A2', '["A2"]',
    'Quarto A2 — Vista Pomar',
    'Quarto com vista para o pomar, 1 cama de casal e 1 cama de solteiro, varanda com rede.',
    3,
    280.00, 280.00, 400.00,
    '["Cama de casal","Cama de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',
    20
  ),
  (
    'A3', '["A3"]',
    'Quarto A3 — Vista Pomar',
    'Quarto com vista para o pomar, 1 cama de casal e 1 cama de solteiro, varanda com rede.',
    3,
    280.00, 280.00, 400.00,
    '["Cama de casal","Cama de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',
    30
  )
ON CONFLICT (code) DO NOTHING;

-- A4–A8 · Casal + 2 Solteiros · max 4 hóspedes
INSERT INTO rooms (
  code, availability_codes, name, description, max_guests,
  base_price_baixa, base_price_media, base_price_alta,
  amenities, sort_order
) VALUES
  (
    'A4', '["A4"]',
    'Quarto A4 — Vista Pomar',
    'Quarto familiar com vista para o pomar, 1 cama de casal e 2 camas de solteiro, varanda com rede.',
    4,
    320.00, 320.00, 440.00,
    '["Cama de casal","2 Camas de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',
    40
  ),
  (
    'A5', '["A5"]',
    'Quarto A5 — Vista Pomar',
    'Quarto familiar com vista para o pomar, 1 cama de casal e 2 camas de solteiro, varanda com rede.',
    4,
    320.00, 320.00, 440.00,
    '["Cama de casal","2 Camas de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',
    50
  ),
  (
    'A6', '["A6"]',
    'Quarto A6 — Vista Pomar',
    'Quarto familiar com vista para o pomar, 1 cama de casal e 2 camas de solteiro, varanda com rede.',
    4,
    320.00, 320.00, 440.00,
    '["Cama de casal","2 Camas de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',
    60
  ),
  (
    'A7', '["A7"]',
    'Quarto A7 — Vista Pomar',
    'Quarto familiar com vista para o pomar, 1 cama de casal e 2 camas de solteiro, varanda com rede.',
    4,
    320.00, 320.00, 440.00,
    '["Cama de casal","2 Camas de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',
    70
  ),
  (
    'A8', '["A8"]',
    'Quarto A8 — Vista Pomar',
    'Quarto familiar com vista para o pomar, 1 cama de casal e 2 camas de solteiro, varanda com rede.',
    4,
    320.00, 320.00, 440.00,
    '["Cama de casal","2 Camas de solteiro","Frigobar","TV 20\"","Ventilador de teto","Varanda","Rede"]',
    80
  )
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- ALA B — Vista para a Montanha
-- ════════════════════════════════════════════════════════════

-- B1 · Casal + 1 Solteiro · max 3 hóspedes
INSERT INTO rooms (
  code, availability_codes, name, description, max_guests,
  base_price_baixa, base_price_media, base_price_alta,
  amenities, sort_order
) VALUES
  (
    'B1', '["B1"]',
    'Quarto B1 — Vista Montanha',
    'Quarto com deslumbrante vista para a montanha, 1 cama de casal e 1 cama de solteiro.',
    3,
    300.00, 300.00, 420.00,
    '["Cama de casal","Cama de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',
    110
  )
ON CONFLICT (code) DO NOTHING;

-- B2–B7 · Casal + 4 Solteiros · max 6 hóspedes
INSERT INTO rooms (
  code, availability_codes, name, description, max_guests,
  base_price_baixa, base_price_media, base_price_alta,
  amenities, sort_order
) VALUES
  (
    'B2', '["B2"]',
    'Quarto B2 — Vista Montanha',
    'Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',
    6,
    380.00, 380.00, 500.00,
    '["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',
    120
  ),
  (
    'B3', '["B3"]',
    'Quarto B3 — Vista Montanha',
    'Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',
    6,
    380.00, 380.00, 500.00,
    '["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',
    130
  ),
  (
    'B4', '["B4"]',
    'Quarto B4 — Vista Montanha',
    'Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',
    6,
    380.00, 380.00, 500.00,
    '["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',
    140
  ),
  (
    'B5', '["B5"]',
    'Quarto B5 — Vista Montanha',
    'Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',
    6,
    380.00, 380.00, 500.00,
    '["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',
    150
  ),
  (
    'B6', '["B6"]',
    'Quarto B6 — Vista Montanha',
    'Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',
    6,
    380.00, 380.00, 500.00,
    '["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',
    160
  ),
  (
    'B7', '["B7"]',
    'Quarto B7 — Vista Montanha',
    'Quarto amplo com vista para a montanha, 1 cama de casal e 4 camas de solteiro.',
    6,
    380.00, 380.00, 500.00,
    '["Cama de casal","4 Camas de solteiro","Frigobar","TV 32\"","Ventilador de teto"]',
    170
  )
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- ALA C — Quarto do Campo
-- ════════════════════════════════════════════════════════════

-- C1–C2 · Grupo · max 8 hóspedes
INSERT INTO rooms (
  code, availability_codes, name, description, max_guests,
  base_price_baixa, base_price_media, base_price_alta,
  amenities, sort_order
) VALUES
  (
    'C1', '["C1"]',
    'Quarto do Campo C1 — Grupo',
    'Quarto do campo espaçoso, ideal para grupos de até 8 pessoas.',
    8,
    480.00, 480.00, 620.00,
    '["Múltiplas camas","TV 20\"","Quarto do Campo"]',
    210
  ),
  (
    'C2', '["C2"]',
    'Quarto do Campo C2 — Grupo',
    'Quarto do campo espaçoso, ideal para grupos de até 8 pessoas.',
    8,
    480.00, 480.00, 620.00,
    '["Múltiplas camas","TV 20\"","Quarto do Campo"]',
    220
  )
ON CONFLICT (code) DO NOTHING;

-- C3–C5 · Casal · max 2 hóspedes
INSERT INTO rooms (
  code, availability_codes, name, description, max_guests,
  base_price_baixa, base_price_media, base_price_alta,
  amenities, sort_order
) VALUES
  (
    'C3', '["C3"]',
    'Quarto do Campo C3 — Casal',
    'Quarto do campo aconchegante para casal.',
    2,
    260.00, 260.00, 380.00,
    '["Cama de casal","TV 20\"","Quarto do Campo"]',
    230
  ),
  (
    'C4', '["C4"]',
    'Quarto do Campo C4 — Casal',
    'Quarto do campo aconchegante para casal.',
    2,
    260.00, 260.00, 380.00,
    '["Cama de casal","TV 20\"","Quarto do Campo"]',
    240
  ),
  (
    'C5', '["C5"]',
    'Quarto do Campo C5 — Casal',
    'Quarto do campo aconchegante para casal.',
    2,
    260.00, 260.00, 380.00,
    '["Cama de casal","TV 20\"","Quarto do Campo"]',
    250
  )
ON CONFLICT (code) DO NOTHING;