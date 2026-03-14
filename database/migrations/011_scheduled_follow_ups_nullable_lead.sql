-- Migration: 011_scheduled_follow_ups_nullable_lead.sql
-- Garante que a tabela scheduled_follow_ups existe com lead_id nullable.
--
-- Caso a tabela NÃO exista (005 nunca foi aplicada): cria do zero.
-- Caso a tabela JÁ exista (005 aplicada com NOT NULL): torna lead_id nullable.

CREATE TABLE IF NOT EXISTS scheduled_follow_ups (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID        REFERENCES leads(id) ON DELETE CASCADE, -- nullable intencional
  phone            TEXT        NOT NULL,
  follow_up_type   TEXT        NOT NULL,
  template_name    TEXT        NOT NULL,
  scheduled_for    TIMESTAMPTZ NOT NULL,
  sent_at          TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'pending',
  -- 'pending', 'sent', 'cancelled', 'failed', 'responded'
  metadata         JSONB       DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Se a tabela já existia com NOT NULL, torna nullable
ALTER TABLE scheduled_follow_ups
  ALTER COLUMN lead_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sfu_pending
  ON scheduled_follow_ups(scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sfu_lead
  ON scheduled_follow_ups(lead_id)
  WHERE lead_id IS NOT NULL;

ALTER TABLE scheduled_follow_ups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scheduled_follow_ups'
      AND policyname = 'sfu_authenticated_all'
  ) THEN
    CREATE POLICY "sfu_authenticated_all"
      ON scheduled_follow_ups FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMENT ON COLUMN scheduled_follow_ups.lead_id IS
  'Opcional — NULL quando o follow-up é criado sem lead associado (ex: seed de exemplo).';
