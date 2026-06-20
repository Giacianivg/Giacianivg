-- ============================================================================
-- 039_online_booking_holds.sql — DEC-025 Bloco 3: reserva online com hold
-- ============================================================================
-- Reserva direta pelo site entra como 'pending' pelo MESMO caminho do CRM
-- (create_reservation_atomic, que já reserva a availability atomicamente — a
-- reserva pending JÁ é o hold). Esta migration só adiciona a EXPIRAÇÃO do hold:
--
--   1. coluna hold_expires_at (só reservas online recebem prazo);
--   2. canal 'site' (atribuição de KPIs — estende o CHECK, aditivo);
--   3. expire_stale_holds(): cancela holds online vencidos → o trigger
--      trg_auto_release_cancelled (migration 002) LIBERA a availability;
--   4. pg_cron agenda a expiração a cada 2 min.
--
-- NÃO altera create_reservation_atomic (caminho sensível fica intocado): o canal
-- e o prazo são gravados pela rota logo após o RPC. Sem exclusion constraint —
-- reusa availability + FOR UPDATE NOWAIT (decisão do Founder na DEC-025).
-- NUNCA alterar migrations 001–038 existentes.
-- ============================================================================

-- 1. Prazo do hold (NULL = sem expiração automática → CRM/WhatsApp intocados).
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;
COMMENT ON COLUMN public.reservations.hold_expires_at IS
  'DEC-025: prazo do hold de reserva online (site). NULL = sem expiração automática.';

CREATE INDEX IF NOT EXISTS idx_res_hold_expiry
  ON public.reservations (hold_expires_at)
  WHERE status = 'pending' AND hold_expires_at IS NOT NULL;

-- 2. Canal 'site' (estende o CHECK existente — aditivo).
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_channel_check;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_channel_check
  CHECK (channel = ANY (ARRAY['whatsapp','booking','airbnb','direct','phone','other','site']));

-- 3. expire_stale_holds(): cancela holds online vencidos sem pagamento confirmado.
--    O cancelamento dispara trg_auto_release_cancelled, que devolve a availability.
CREATE OR REPLACE FUNCTION public.expire_stale_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_count int;
BEGIN
  WITH expired AS (
    UPDATE public.reservations r
       SET status       = 'cancelled',
           cancelled_at = now(),
           notes        = COALESCE(r.notes, '') || ' [hold expirado ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ']'
     WHERE r.status = 'pending'
       AND r.hold_expires_at IS NOT NULL
       AND r.hold_expires_at < now()
       AND NOT EXISTS (
         SELECT 1 FROM public.payments p
          WHERE p.reservation_id = r.id AND p.status = 'confirmed'
       )
    RETURNING r.id
  )
  SELECT count(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$function$;

COMMENT ON FUNCTION public.expire_stale_holds() IS
  'DEC-025 Bloco 3: cancela reservas online pending com hold vencido (sem pagamento confirmado). trg_auto_release_cancelled libera a availability.';

-- 4. pg_cron: expira a cada 2 min. Resiliente — não falha a migration se a
--    extensão não puder ser criada no ambiente (ex.: local sem privilégio).
DO $cron$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('expire-holds', '*/2 * * * *', 'SELECT public.expire_stale_holds();');
  RAISE NOTICE 'pg_cron: job expire-holds agendado (*/2 min).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível aqui (%) — agende public.expire_stale_holds() em produção.', SQLERRM;
END $cron$;
