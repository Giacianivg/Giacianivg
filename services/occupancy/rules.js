'use strict';

/**
 * Regras canônicas de ocupação — DEC-024.
 * Fonte JS ÚNICA das regras que as telas e o endpoint /api/occupancy seguem.
 * Espelham as views SQL (vw_room_day_status, vw_today_board, vw_reservation_balance):
 *
 *   • Fronteira: ocupado se checkin <= dia < checkout (dia do checkout = LIVRE).
 *   • Status ativos p/ ocupação: confirmed, checkedin (checkedout/cancelled não ocupam).
 *   • "Hoje": America/Sao_Paulo.
 *   • Saldo: total + consumo − sinal − pagamentos confirmados.
 */

const ACTIVE_OCCUPANCY = ['confirmed', 'checkedin'];          // ocupam o quarto
const CHECKIN_TODAY    = ['pending', 'confirmed', 'checkedin']; // chegando hoje
const CHECKOUT_TODAY   = ['confirmed', 'checkedin'];           // saindo hoje (exclui checkedout)

// "Hoje" em America/Sao_Paulo como YYYY-MM-DD (en-CA dá o formato ISO).
function todayBR(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

// Fronteira de ocupação por noite: checkin <= dia < checkout.
function isOccupiedNight(checkinISO, checkoutISO, dateISO) {
  return dateISO >= checkinISO && dateISO < checkoutISO;
}

function isActiveOccupancy(status) {
  return ACTIVE_OCCUPANCY.includes(status);
}

// Chegando hoje: checkin é hoje e o status ainda não saiu/cancelou.
function isCheckinToday(status, checkinISO, todayISO) {
  return checkinISO === todayISO && CHECKIN_TODAY.includes(status);
}

// Saindo hoje: checkout é hoje e ainda NÃO fez check-out (exclui checkedout).
function isCheckoutToday(status, checkoutISO, todayISO) {
  return checkoutISO === todayISO && CHECKOUT_TODAY.includes(status);
}

// Em casa: ativo e hoje está dentro de [checkin, checkout).
function isInHouse(status, checkinISO, checkoutISO, todayISO) {
  return isActiveOccupancy(status) && checkinISO <= todayISO && checkoutISO > todayISO;
}

// Saldo (mesma conta da RPC checkout_reservation e da vw_reservation_balance).
function balanceDue({ room_total = 0, charges_total = 0, deposit_paid = 0, payments_confirmed = 0 }) {
  return Number(room_total) + Number(charges_total) - Number(deposit_paid) - Number(payments_confirmed);
}

// Total efetivamente pago pelo hóspede = sinal + pagamentos confirmados.
function totalPaid({ deposit_paid = 0, payments_confirmed = 0 }) {
  return Number(deposit_paid) + Number(payments_confirmed);
}

module.exports = {
  ACTIVE_OCCUPANCY, CHECKIN_TODAY, CHECKOUT_TODAY,
  todayBR, isOccupiedNight, isActiveOccupancy,
  isCheckinToday, isCheckoutToday, isInHouse,
  balanceDue, totalPaid,
};
