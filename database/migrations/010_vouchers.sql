-- Migration 010: Vouchers de hospedagem
-- PLU-12.1 | DEC-016 | 2026-03-12

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
