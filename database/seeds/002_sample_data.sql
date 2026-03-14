-- ============================================================
-- SEED 002 — Dados de exemplo para validação de UI
-- Pousada Luz da Lua | PLU-12.1 sprint emergencial
-- Rodar no Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── VOUCHERS ────────────────────────────────────────────────
INSERT INTO vouchers (guest_name, room_type, check_in, check_out, guests, source, total_amount, status, notes)
VALUES
  ('Maria Silva',       'ALA_B',        '2026-04-18', '2026-04-20', 4, 'direct',   1200.00, 'active',    NULL),
  ('João Costa',        'ALA_A',        '2026-04-22', '2026-04-24', 2, 'booking',   850.00, 'active',    'Café da manhã incluído'),
  ('Ana Lima',          'ALA_C_CASAL',  '2026-05-01', '2026-05-05', 6, 'expedia',  2400.00, 'active',    NULL),
  ('Pedro Souza',       'ALA_A',        '2026-03-14', '2026-03-16', 2, 'whatsapp',  720.00, 'active',    'Chegada prevista 14h'),
  ('Fernanda Rocha',    'ALA_B',        '2026-03-20', '2026-03-22', 3, 'direct',    900.00, 'cancelled', 'Cancelado a pedido'),
  ('Carlos Mendes',     'ALA_C_GRUPO',  '2026-05-15', '2026-05-18', 8, 'booking',  3600.00, 'active',    NULL),
  ('Juliana Pereira',   'ALA_A',        '2026-04-28', '2026-04-30', 2, 'direct',    800.00, 'active',    NULL),
  ('Rafael Oliveira',   'ALA_B',        '2026-06-05', '2026-06-08', 4, 'expedia',  1500.00, 'active',    'EBAA — chegada tarde')
ON CONFLICT DO NOTHING;

-- ─── LEADS ───────────────────────────────────────────────────
INSERT INTO leads (whatsapp_number, name, email, funnel_stage, created_at, updated_at)
VALUES
  ('5519998000001', 'Maria Silva',    'maria@gmail.com',    'proposal',     NOW() - INTERVAL '5 days',  NOW() - INTERVAL '1 day'),
  ('5519998000002', 'João Costa',     NULL,                 'qualified',    NOW() - INTERVAL '3 days',  NOW() - INTERVAL '3 hours'),
  ('5519998000003', 'Ana Lima',       'ana.lima@email.com', 'confirmed',    NOW() - INTERVAL '7 days',  NOW() - INTERVAL '2 days'),
  ('5519998000004', 'Pedro Souza',    NULL,                 'qualified',    NOW() - INTERVAL '2 days',  NOW() - INTERVAL '6 hours'),
  ('5519998000005', 'Carlos Mendes',  NULL,                 'new',          NOW() - INTERVAL '1 day',   NOW() - INTERVAL '1 day'),
  ('5519998000006', 'Juliana Pereira',NULL,                 'qualified',    NOW() - INTERVAL '4 days',  NOW() - INTERVAL '4 hours'),
  ('5519998000007', 'Rafael Oliveira',NULL,                 'proposal',     NOW() - INTERVAL '6 days',  NOW() - INTERVAL '12 hours'),
  ('5519998000008', 'Fernanda Rocha', NULL,                 'new',          NOW() - INTERVAL '1 hour',  NOW() - INTERVAL '1 hour')
ON CONFLICT (whatsapp_number) DO UPDATE
  SET name = EXCLUDED.name, funnel_stage = EXCLUDED.funnel_stage, updated_at = EXCLUDED.updated_at;

-- ─── FOLLOW-UPS (apenas se tabela existir) ───────────────────
-- NB: lead_id é opcional — use NULL se não houver lead correspondente
INSERT INTO scheduled_follow_ups (phone, follow_up_type, template_name, scheduled_for, status, metadata)
SELECT * FROM (VALUES
  ('5519998000001', 'quote_followup',   'quote_followup_24h',  NOW() - INTERVAL '1 day',  'pending',   '{"source":"booking"}'::jsonb),
  ('5519998000002', 'no_response',      'no_response_48h',     NOW() - INTERVAL '2 hours','pending',   '{"source":"whatsapp"}'::jsonb),
  ('5519998000003', 'post_stay',        'post_stay_d1',        NOW() + INTERVAL '2 hours','pending',   '{}'::jsonb),
  ('5519998000004', 'reactivation',     'reactivation_d7',     NOW() + INTERVAL '1 day',  'pending',   '{}'::jsonb),
  ('5519998000005', 'quote_followup',   'quote_followup_24h',  NOW() - INTERVAL '3 days', 'sent',      '{"sent_at":"2026-03-09"}'::jsonb),
  ('5519998000006', 'post_stay',        'post_stay_d1',        NOW() - INTERVAL '5 days', 'responded', '{}'::jsonb),
  ('5519998000007', 'reactivation',     'reactivation_d30',    NOW() + INTERVAL '3 days', 'pending',   '{}'::jsonb)
) AS v(phone, follow_up_type, template_name, scheduled_for, status, metadata)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'scheduled_follow_ups'
)
ON CONFLICT DO NOTHING;
