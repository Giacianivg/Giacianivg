-- ============================================================
-- Migration 025: Placa do veículo na reserva
-- ============================================================
-- Campo opcional preenchido na criação/edição da reserva (CRM).
-- Formatos aceitos: antigo (ABC1234) e Mercosul (ABC1D23) — sem
-- validação rígida no banco, normalização (uppercase) fica no app.

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(10);

COMMENT ON COLUMN reservations.vehicle_plate IS 'Placa do veículo do hóspede (opcional)';
