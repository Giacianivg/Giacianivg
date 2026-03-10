-- Migration 008: Luna Config — configuração e treinamento da Luna
-- DEC-009 aprovado 2026-03-10
-- NUNCA alterar migrations 001–007 existentes

CREATE TABLE IF NOT EXISTS luna_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt   TEXT        NOT NULL DEFAULT '',
  personality     JSONB       NOT NULL DEFAULT '{"nome":"Luna","tom":"acolhedor","emoji":true}',
  scripts         JSONB       NOT NULL DEFAULT '{"saudacao":"","cotacao":"","objecao":"","fechamento":""}',
  active_packages JSONB       NOT NULL DEFAULT '[]',
  version         INT         NOT NULL DEFAULT 1,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      TEXT        NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS luna_config_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt   TEXT        NOT NULL DEFAULT '',
  personality     JSONB       NOT NULL DEFAULT '{}',
  scripts         JSONB       NOT NULL DEFAULT '{}',
  active_packages JSONB       NOT NULL DEFAULT '[]',
  version         INT         NOT NULL,
  saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_by        TEXT        NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_luna_history_version ON luna_config_history (version DESC);

-- Seed: config inicial (singleton via fixed uuid — safe to re-run)
INSERT INTO luna_config (
  id,
  system_prompt,
  personality,
  scripts,
  active_packages,
  version,
  updated_by
) VALUES (
  '10000000-0000-0000-0000-000000000009'::uuid,
  '',
  '{"nome":"Luna","tom":"acolhedor","emoji":true}',
  '{"saudacao":"","cotacao":"","objecao":"","fechamento":""}',
  '[]',
  1,
  'system'
) ON CONFLICT (id) DO NOTHING;
