-- Migration 012: Quartos individuais reais da pousada
-- Substitui os 4 registros de ala genérica por 20 quartos individuais
-- Ala A: A1-A8 (Standard / Superior) · R$280
-- Ala B: B1-B7 (Chalé Tipo B)        · R$320
-- Ala C: C1-C5 (Chalé Tipo C)        · R$300
-- NUNCA alterar migrations 001–011 existentes

-- Desativa os 4 registros de ala genérica (mantém histórico)
UPDATE rooms
   SET active = false
 WHERE code IN ('ALA_A', 'ALA_B', 'ALA_C_CASAL', 'ALA_C_GRUPO');

-- ── Ala A (sort 10–80) ───────────────────────────────────────────────────────
INSERT INTO rooms (code, availability_codes, name, description, max_guests,
                   base_price_baixa, base_price_media, base_price_alta,
                   amenities, sort_order)
VALUES
  ('A1','["A1"]','Quarto A1','Standard com varanda, vista jardim',3, 280.00,280.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar"]',10),
  ('A2','["A2"]','Quarto A2','Standard com varanda, vista jardim',3, 280.00,280.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar"]',20),
  ('A3','["A3"]','Quarto A3','Standard com varanda, vista jardim',3, 280.00,280.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar"]',30),
  ('A4','["A4"]','Quarto A4','Standard com varanda, vista jardim',3, 280.00,280.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar"]',40),
  ('A5','["A5"]','Quarto A5','Superior com varanda ampla',         3, 280.00,280.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Banheira"]',50),
  ('A6','["A6"]','Quarto A6','Superior com varanda ampla',         3, 280.00,280.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Banheira"]',60),
  ('A7','["A7"]','Quarto A7','Superior com varanda ampla',         3, 280.00,280.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Banheira"]',70),
  ('A8','["A8"]','Quarto A8','Superior com varanda ampla',         3, 280.00,280.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Banheira"]',80)
ON CONFLICT (code) DO NOTHING;

-- ── Ala B (sort 110–170) ─────────────────────────────────────────────────────
INSERT INTO rooms (code, availability_codes, name, description, max_guests,
                   base_price_baixa, base_price_media, base_price_alta,
                   amenities, sort_order)
VALUES
  ('B1','["B1"]','Chalé B1','Chalé Tipo B, vista para a mata',5, 320.00,350.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Varanda"]',110),
  ('B2','["B2"]','Chalé B2','Chalé Tipo B, vista para a mata',5, 320.00,350.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Varanda"]',120),
  ('B3','["B3"]','Chalé B3','Chalé Tipo B, vista para a mata',5, 320.00,350.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Varanda"]',130),
  ('B4','["B4"]','Chalé B4','Chalé Tipo B, vista para a mata',5, 320.00,350.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Varanda"]',140),
  ('B5','["B5"]','Chalé B5','Chalé Tipo B, vista para a mata',5, 320.00,350.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Varanda"]',150),
  ('B6','["B6"]','Chalé B6','Chalé Tipo B, vista para a mata',5, 320.00,350.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Varanda"]',160),
  ('B7','["B7"]','Chalé B7','Chalé Tipo B, vista para a mata',5, 320.00,350.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Varanda"]',170)
ON CONFLICT (code) DO NOTHING;

-- ── Ala C (sort 210–250) ─────────────────────────────────────────────────────
INSERT INTO rooms (code, availability_codes, name, description, max_guests,
                   base_price_baixa, base_price_media, base_price_alta,
                   amenities, sort_order)
VALUES
  ('C1','["C1"]','Chalé C1','Chalé Tipo C, cama casal king, suite',8, 300.00,300.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Banheira","Varanda","Hidromassagem"]',210),
  ('C2','["C2"]','Chalé C2','Chalé Tipo C, cama casal king, suite',8, 300.00,300.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Banheira","Varanda","Hidromassagem"]',220),
  ('C3','["C3"]','Chalé C3','Chalé Tipo C, cama casal king, suite',8, 300.00,300.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Banheira","Varanda","Hidromassagem"]',230),
  ('C4','["C4"]','Chalé C4','Chalé Tipo C, cama casal king, suite',8, 300.00,300.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Banheira","Varanda","Hidromassagem"]',240),
  ('C5','["C5"]','Chalé C5','Chalé Tipo C, cama casal king, suite',8, 300.00,300.00,400.00,'["Ar-condicionado","Wi-Fi","TV","Frigobar","Banheira","Varanda","Hidromassagem"]',250)
ON CONFLICT (code) DO NOTHING;
