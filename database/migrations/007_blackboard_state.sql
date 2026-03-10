-- Migration 007: Blackboard State — estado compartilhado entre agentes AI-OS
-- DEC-007 aprovado 2026-03-10
-- NUNCA alterar migrations 001–006 existentes

CREATE TABLE IF NOT EXISTS blackboard_state (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dados iniciais (no-op se já existir)
INSERT INTO blackboard_state (key, value) VALUES
  ('leads',      '{"total":0,"ativos":0,"score_medio":0,"ultimo_update":null}'),
  ('reservas',   '{"hoje":0,"semana":0,"mes":0,"ocupacao_pct":0}'),
  ('financeiro', '{"mrr":0,"cac":0,"ticket_medio":0}'),
  ('alertas',    '[]')
ON CONFLICT (key) DO NOTHING;
