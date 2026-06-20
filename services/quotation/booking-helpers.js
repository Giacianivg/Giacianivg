'use strict';

/**
 * Helpers puros da reserva online (DEC-025 Bloco 3).
 * Sem I/O — testáveis isoladamente. A rota usa estes + o engine + o RPC.
 */

const DEPOSIT_PCT  = 30;            // sinal padrão (igual ao sistema atual)
const HOLD_MINUTES = 30;            // hold da reserva online (decisão do Founder)

/** Normaliza WhatsApp para só dígitos; retorna null se fora de 10–15 dígitos. */
function normalizeWhatsapp(raw) {
  const digits = String(raw == null ? '' : raw).replace(/\D/g, '');
  return /^\d{10,15}$/.test(digits) ? digits : null;
}

/** Nome válido: string com 2–120 caracteres não-vazios. */
function isValidName(name) {
  return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 120;
}

/** Sinal (30%) arredondado a partir do total. */
function computeDeposit(total, pct = DEPOSIT_PCT) {
  return Math.round(Number(total) * (pct / 100));
}

/** Timestamp ISO de expiração do hold (agora + HOLD_MINUTES). */
function holdExpiryISO(fromMs = Date.now(), minutes = HOLD_MINUTES) {
  return new Date(fromMs + minutes * 60_000).toISOString();
}

module.exports = { normalizeWhatsapp, isValidName, computeDeposit, holdExpiryISO, DEPOSIT_PCT, HOLD_MINUTES };
