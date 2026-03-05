'use strict';

/**
 * Modulo de calculo de cotacao -- Pousada Luz da Lua
 * Usado pelo endpoint POST /quote do webhook handler.
 */

// Precos por tipo de quarto em temporadas baixa e media.
// Alta/feriado usam precificacao por pessoa (ver calcNightPrice).
const PRICE_TABLE = {
  ALA_A:       { baixa: 300, media: 300 },
  ALA_B:       { baixa: 300, media: 350 },
  ALA_C_CASAL: { baixa: 300, media: 300 },
};

// Alta/feriado: R$400 base (ate 2 pax) + R$150 por pessoa acima de 2
const ALTA_BASE_PRICE = 400;
const ALTA_EXTRA_PER_PERSON = 150;

const SEASON_LABEL = {
  baixa:   'dias uteis',
  media:   'fins de semana',
  alta:    'alta temporada',
  feriado: 'feriados',
};

const TIPO_LABEL = {
  ALA_A:       'Standard Casal (Ala A)',
  ALA_B:       'Familia (Ala B)',
  ALA_C_CASAL: 'Casal Especial (Ala C)',
};

// Feriados com precificacao especial (atualizar anualmente)
const FERIADO_RANGES = [
  { startMd: '02-20', endMd: '02-25' }, // Carnaval 2026
  { startMd: '03-28', endMd: '04-06' }, // Semana Santa + Pascoa 2026
  { startMd: '12-24', endMd: '01-02' }, // Natal/Reveillon (cruza ano)
];

function parseDate(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split('/');
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}

function formatDateStr(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function addDays(date, n) {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

function calcNights(entrada, saida) {
  return Math.round((parseDate(saida) - parseDate(entrada)) / (1000 * 60 * 60 * 24));
}

function isFeriado(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const md = `${mm}-${dd}`;
  return FERIADO_RANGES.some(({ startMd, endMd }) => {
    if (startMd <= endMd) return md >= startMd && md <= endMd;
    return md >= startMd || md <= endMd; // cruza virada do ano
  });
}

function detectSeason(dateStr) {
  const d = parseDate(dateStr);
  const month = d.getMonth() + 1;
  const dow = d.getDay();
  if (isFeriado(d)) return 'feriado';
  if ([1, 7, 12].includes(month)) return 'alta';
  if (dow === 0 || dow === 6) return 'media';
  return 'baixa';
}

function calcNightPrice(tipo, season, pessoas) {
  if (season === 'alta' || season === 'feriado') {
    return ALTA_BASE_PRICE + Math.max(0, pessoas - 2) * ALTA_EXTRA_PER_PERSON;
  }
  return PRICE_TABLE[tipo][season];
}

function calcDiscount(nights) {
  if (nights >= 14) return 0.15;
  if (nights >= 7) return 0.10;
  return 0;
}

/**
 * Calcula cotacao com prorateio noite a noite e precificacao por pessoa em alta.
 * @param {object} params - { data_entrada, data_saida, pessoas, tipo }
 * @returns {object} cotacao calculada ou { error, ... }
 */
function calculateQuotation(params) {
  const { data_entrada, data_saida, pessoas, tipo } = params;

  if (!data_entrada || !data_saida || !pessoas || !tipo) {
    return { error: 'Parametros obrigatorios: data_entrada, data_saida, pessoas, tipo' };
  }

  if (tipo === 'ALA_C_GRUPO') {
    return { error: 'ALA_C_GRUPO requer atendimento humano', escalar: true };
  }

  if (!PRICE_TABLE[tipo]) {
    return { error: `Tipo de quarto invalido: ${tipo}. Use: ALA_A, ALA_B, ALA_C_CASAL, ALA_C_GRUPO` };
  }

  const nights = calcNights(data_entrada, data_saida);
  if (nights <= 0) {
    return { error: 'Datas invalidas -- check-in deve ser antes do check-out' };
  }

  const numPessoas = parseInt(pessoas);

  // Validacao de minimo de noites (DB-12)
  const entradaDate = parseDate(data_entrada);
  const entradaDow = entradaDate.getDay();
  const entradaSeason = detectSeason(data_entrada);
  const isWeekendStart = entradaDow === 5 || entradaDow === 6; // sexta ou sabado
  const isAltaStart = entradaSeason === 'alta' || entradaSeason === 'feriado';
  const minNights = (isWeekendStart || isAltaStart) ? 2 : 1;

  if (nights < minNights) {
    const reason = isWeekendStart ? 'fins de semana' : 'alta temporada';
    return {
      error: `Para ${reason}, nossa estadia minima e de ${minNights} noite${minNights > 1 ? 's' : ''}`,
      minNights,
      suggestion: `Posso montar a cotacao para ${minNights} noites?`,
    };
  }

  // Prorateio noite a noite
  const breakdown = [];
  let totalBruto = 0;

  for (let i = 0; i < nights; i++) {
    const nightDate = addDays(entradaDate, i);
    const nightSeason = detectSeason(formatDateStr(nightDate));
    const nightPrice = calcNightPrice(tipo, nightSeason, numPessoas);
    totalBruto += nightPrice;

    const last = breakdown[breakdown.length - 1];
    if (last && last.season === nightSeason && last.price === nightPrice) {
      last.nights++;
    } else {
      breakdown.push({ season: nightSeason, price: nightPrice, nights: 1 });
    }
  }

  const descontoFrac = calcDiscount(nights);
  const totalFinal = Math.round(totalBruto * (1 - descontoFrac));
  const valorDesconto = totalBruto - totalFinal;

  return {
    data_entrada,
    data_saida,
    tipo,
    tipoLabel: TIPO_LABEL[tipo] || tipo,
    pessoas: numPessoas,
    nights,
    totalBruto,
    desconto: Math.round(descontoFrac * 100),
    valorDesconto,
    totalFinal,
    breakdown,
    season: breakdown[0].season,       // compat: temporada da primeira noite
    precoPorNoite: breakdown[0].price,  // compat: preco da primeira noite
  };
}

/**
 * Formata cotacao como mensagem WhatsApp pronta para envio.
 * Exibe breakdown por periodo quando ha prorateio de temporadas.
 */
function formatWhatsAppMessage(q) {
  const breakdownStr = q.breakdown.length === 1
    ? `${q.breakdown[0].nights} noite${q.breakdown[0].nights > 1 ? 's' : ''} x R$ ${q.breakdown[0].price} (${SEASON_LABEL[q.breakdown[0].season]})`
    : q.breakdown.map(p => `${p.nights} noite${p.nights > 1 ? 's' : ''} x R$ ${p.price} (${SEASON_LABEL[p.season]})`).join(' + ');

  const descontoLine = q.desconto > 0
    ? `\uD83C\uDF81 Desconto estada longa (${q.desconto}%): -R$ ${q.valorDesconto}\n`
    : '';

  return `\uD83C\uDF19 *Cota\u00E7\u00E3o \u2014 Pousada Luz da Lua*

\uD83D\uDCC5 Check-in: ${q.data_entrada} | Check-out: ${q.data_saida}
\uD83D\uDECF\uFE0F Tipo: ${q.tipoLabel}
\uD83D\uDC65 H\u00F3spedes: ${q.pessoas}
\uD83C\uDF19 Noites: ${q.nights}

\uD83D\uDCB0 ${breakdownStr}
${descontoLine}\uD83D\uDCB3 *Total: R$ ${q.totalFinal}*

\u2705 Incluso: Caf\u00E9 da manh\u00E3, Wi-Fi
\uD83D\uDC3E Pets: aceitos (taxa de R$20/dia por animal)
\u274C Cancelamento: gratuito at\u00E9 7 dias antes do check-in
\uD83D\uDCCD Socorro-SP \u2014 Circuito das \u00C1guas Paulista

Para reservar, acesse: https://pousadaluzdaluasp.com.br
Ou responda *CONFIRMAR* para que nossa equipe finalize sua reserva! \uD83C\uDF3F`;
}

module.exports = { calculateQuotation, formatWhatsAppMessage };
