'use strict';

/**
 * Montagem de ofertas públicas do site (DEC-025 Bloco 2) — FUNÇÃO PURA.
 *
 * Para datas + nº de hóspedes, decide quais alas cabem e estão disponíveis e
 * anexa a cotação REAL de cada uma. Regras-chave:
 *  - Preço: SEMPRE do motor único (services/quotation/engine.js). Nada é
 *    recalculado aqui — só repassamos o resultado de calculateQuotation.
 *  - Disponibilidade: a partir de vw_ala_sellable (já desconta reservados E
 *    bloqueios/manutenção — migration 038). Ausência de linha = ala cheia.
 *  - Capacidade: lida de `rooms` (não hardcodada) — a maior capacidade de
 *    quarto físico da ala.
 *
 * Pura e testável: recebe `roomsByAla` e `sellableMap` já carregados do banco
 * pela rota, e aceita `calcQuote` injetável (default = engine real).
 */

const { fromDB, dateRange } = require('../utils/dates');
const { calculateQuotation } = require('./engine');

// Tipos cotáveis pela Luna/site e a ala física correspondente (1ª letra do code).
// ALA_C_GRUPO fica de fora (sempre atendimento humano).
const QUOTABLES = [
  { tipo: 'ALA_A',       ala: 'A' },
  { tipo: 'ALA_B',       ala: 'B' },
  { tipo: 'ALA_C_CASAL', ala: 'C' },
];

/**
 * @param {object} p
 * @param {string} p.checkin  - YYYY-MM-DD
 * @param {string} p.checkout - YYYY-MM-DD
 * @param {number} p.guests
 * @param {number} p.nights
 * @param {Object<string,{maxGuests:number,totalRooms:number}>} p.roomsByAla
 * @param {Map<string,number>} p.sellableMap - chave "ALA|YYYY-MM-DD" → sellable
 * @param {function} [p.calcQuote] - injeção p/ teste (default: engine real)
 * @returns {{checkin,checkout,guests,nights,offers:Array,group_inquiry:boolean}}
 */
function buildOffers({ checkin, checkout, guests, nights, roomsByAla, sellableMap, calcQuote = calculateQuotation }) {
  const dates  = dateRange(checkin, checkout);
  const offers = [];
  let maxCapacity = 0;

  for (const { tipo, ala } of QUOTABLES) {
    const info = roomsByAla[ala];
    if (!info || info.totalRooms === 0) continue;
    if (info.maxGuests > maxCapacity) maxCapacity = info.maxGuests;

    // Não cabe o grupo nesta ala → não ofertamos esta ala.
    if (guests > info.maxGuests) continue;

    // Disponível = sellable >= 1 em TODAS as noites. Ausência de linha = ala cheia.
    let available = true;
    for (const d of dates) {
      const key = `${ala}|${d}`;
      const sellable = sellableMap.has(key) ? sellableMap.get(key) : info.totalRooms;
      if (sellable < 1) { available = false; break; }
    }

    const quote = calcQuote({
      data_entrada: fromDB(checkin),
      data_saida:   fromDB(checkout),
      pessoas:      guests,
      tipo,
    });

    const offer = {
      room_type:   tipo,
      label:       (quote && quote.tipoLabel) || tipo,
      max_guests:  info.maxGuests,
      available,
      nights,
      total_price: null,
      breakdown:   null,
      desconto:    0,
      notice:      null,
      min_nights:  null,
    };

    if (quote && quote.error) {
      offer.notice = quote.suggestion || quote.error;
      if (quote.minNights) offer.min_nights = quote.minNights;
    } else if (quote) {
      offer.total_price = quote.totalFinal;
      offer.breakdown   = quote.breakdown;
      offer.desconto    = quote.desconto;
    }

    offers.push(offer);
  }

  // Disponível + com preço primeiro; depois por menor preço.
  offers.sort((a, b) =>
    (Number(b.available) - Number(a.available)) ||
    ((a.total_price ?? Infinity) - (b.total_price ?? Infinity))
  );

  // Acima da maior ala (ex.: grupos > 8) → atendimento humano (ALA_C_GRUPO).
  const group_inquiry = guests > maxCapacity;

  return { checkin, checkout, guests, nights, offers, group_inquiry };
}

module.exports = { buildOffers, QUOTABLES };
