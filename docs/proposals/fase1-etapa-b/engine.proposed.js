'use strict';

/**
 * PROPOSTA Fase 1 / Etapa B — NÃO APLICADO
 * Substitui services/quotation/engine.js após aprovação CTO.
 *
 * Modulo de calculo de cotacao — config-driven.
 * Preços/labels vêm de rooms + settings + special_periods + packages (Supabase),
 * com cache de 5 min e fallback nos valores hardcoded atuais (DEFAULT_CONFIG).
 *
 * API pública INALTERADA (síncrona): calculateQuotation, formatWhatsAppMessage,
 * getPascoaPackage, PASCOA_PACKAGE. Nenhum call site muda.
 *
 * Padrão de refresh: getConfig() retorna o cache imediatamente e dispara
 * refresh em background quando expira (mesmo padrão de settings/branding.js).
 * Primeira cotação após cold start usa os defaults — como os seeds do banco
 * são idênticos aos defaults, o resultado é byte-idêntico para a Luz da Lua.
 */

const { getBranding } = require('../settings/branding');

// ─── DEFAULT_CONFIG — valores hardcoded atuais (fallback permanente) ─────────

const DEFAULT_CONFIG = {
  // Precos por tipo de quarto em temporadas baixa e media.
  priceTable: {
    ALA_A:       { baixa: 300, media: 300 },
    ALA_B:       { baixa: 300, media: 350 },
    ALA_C_CASAL: { baixa: 300, media: 300 },
  },
  tipoLabel: {
    ALA_A:       'Standard Casal (Ala A)',
    ALA_B:       'Familia (Ala B)',
    ALA_C_CASAL: 'Casal Especial (Ala C)',
  },
  // Alta/feriado: base (ate 2 pax) + extra por pessoa acima de 2
  altaBasePrice: 400,
  altaExtraPerPerson: 150,
  discount7PlusPct: 10,
  discount14PlusPct: 15,
  petFeePerDay: 20,
  feriadoRanges: [
    { startMd: '02-13', endMd: '02-18', label: 'Carnaval 2026' },
    { startMd: '03-28', endMd: '04-06', label: 'Semana Santa/Páscoa 2026' },
    { startMd: '06-04', endMd: '06-07', label: 'EBAA/Corpus Christi 2026' },
    { startMd: '09-05', endMd: '09-07', label: 'Independência 2026' },
    { startMd: '10-10', endMd: '10-12', label: 'Aparecida 2026' },
    { startMd: '11-20', endMd: '11-22', label: 'Consciência Negra 2026' },
    { startMd: '12-24', endMd: '01-02', label: 'Natal/Réveillon' },
  ],
  packages: [{
    nome: 'Escapada Romântica Páscoa',
    startDate: '2026-03-28',
    endDate: '2026-04-06',
    noites: 2,
    pessoas: 2,
    preco: 900,
    incluso: 'Café da manhã incluso',
    descricao: '2 noites + café da manhã para 2 pessoas',
  }],
};

const SEASON_LABEL = {
  baixa:   'dias uteis',
  media:   'fins de semana',
  alta:    'alta temporada',
  feriado: 'feriados',
};

// ─── Cache de configuração (rooms + settings + special_periods + packages) ──

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cfg = DEFAULT_CONFIG;
let _cfgTs = 0;
let _refreshing = false;
let _warnedOnce = false;

const PRICING_KEYS = ['alta_base_price', 'alta_extra_per_person', 'discount_7plus_pct', 'discount_14plus_pct', 'pet_fee_per_day'];
const QUOTABLE_CODES = ['ALA_A', 'ALA_B', 'ALA_C_CASAL'];

async function fetchPricingConfig() {
  const { supabaseAdmin } = require('../supabase/client');

  const [roomsRes, settingsRes, periodsRes, packagesRes] = await Promise.all([
    // NOTA: busca por code, NÃO por active — as linhas ALA_* estão active=false
    // no banco (os quartos físicos A1-C5 é que estão ativos). Divergência de
    // dados a resolver com o Founder; aqui preservamos o comportamento atual.
    supabaseAdmin.from('rooms').select('code, base_price_baixa, base_price_media').in('code', QUOTABLE_CODES),
    supabaseAdmin.from('settings').select('key, value').in('key', PRICING_KEYS),
    supabaseAdmin.from('special_periods').select('label, start_md, end_md').eq('active', true),
    supabaseAdmin.from('packages').select('name, description, start_date, end_date, nights, max_guests, price, includes').eq('active', true),
  ]);

  const cfg = {
    ...DEFAULT_CONFIG,
    priceTable: { ...DEFAULT_CONFIG.priceTable },
    feriadoRanges: DEFAULT_CONFIG.feriadoRanges,
    packages: DEFAULT_CONFIG.packages,
  };

  if (!roomsRes.error && roomsRes.data?.length) {
    for (const r of roomsRes.data) {
      cfg.priceTable[r.code] = {
        baixa: Number(r.base_price_baixa),
        media: Number(r.base_price_media),
      };
    }
  }

  if (!settingsRes.error && settingsRes.data?.length) {
    const s = Object.fromEntries(settingsRes.data.map(r => [r.key, Number(r.value)]));
    if (Number.isFinite(s.alta_base_price))       cfg.altaBasePrice = s.alta_base_price;
    if (Number.isFinite(s.alta_extra_per_person)) cfg.altaExtraPerPerson = s.alta_extra_per_person;
    if (Number.isFinite(s.discount_7plus_pct))    cfg.discount7PlusPct = s.discount_7plus_pct;
    if (Number.isFinite(s.discount_14plus_pct))   cfg.discount14PlusPct = s.discount_14plus_pct;
    if (Number.isFinite(s.pet_fee_per_day))       cfg.petFeePerDay = s.pet_fee_per_day;
  }

  if (!periodsRes.error && periodsRes.data?.length) {
    cfg.feriadoRanges = periodsRes.data.map(p => ({
      startMd: p.start_md, endMd: p.end_md, label: p.label,
    }));
  }

  if (!packagesRes.error && packagesRes.data?.length) {
    cfg.packages = packagesRes.data.map(p => ({
      nome: p.name,
      startDate: p.start_date,
      endDate: p.end_date,
      noites: p.nights,
      pessoas: p.max_guests,
      preco: Number(p.price),
      incluso: p.includes,
      descricao: p.description,
    }));
  }

  return cfg;
}

function refreshInBackground() {
  if (_refreshing) return;
  _refreshing = true;
  fetchPricingConfig()
    .then(cfg => { _cfg = cfg; _cfgTs = Date.now(); })
    .catch(err => {
      if (!_warnedOnce) {
        _warnedOnce = true;
        console.warn('[quotation] config do banco indisponível, usando defaults:', err.message);
      }
      _cfgTs = Date.now();
    })
    .finally(() => { _refreshing = false; });
}

function getConfig() {
  if (Date.now() - _cfgTs >= CACHE_TTL_MS) refreshInBackground();
  return _cfg;
}

/** Invalida o cache (testes / após editar quartos ou settings no CRM). */
function invalidatePricingCache() {
  _cfg = DEFAULT_CONFIG;
  _cfgTs = 0;
}

// ─── Helpers de data (inalterados) ──────────────────────────────────────────

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

// ─── Lógica de temporada/preço (agora lê do config) ─────────────────────────

function isFeriado(date, cfg) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const md = `${mm}-${dd}`;
  return cfg.feriadoRanges.some(({ startMd, endMd }) => {
    if (startMd <= endMd) return md >= startMd && md <= endMd;
    return md >= startMd || md <= endMd; // cruza virada do ano
  });
}

function detectSeason(dateStr, cfg) {
  const d = parseDate(dateStr);
  const month = d.getMonth() + 1;
  const dow = d.getDay();
  if (isFeriado(d, cfg)) return 'feriado';
  if ([1, 7, 12].includes(month)) return 'alta';
  if (dow === 0 || dow === 6) return 'media';
  return 'baixa';
}

function calcNightPrice(tipo, season, pessoas, cfg) {
  if (season === 'alta' || season === 'feriado') {
    return cfg.altaBasePrice + Math.max(0, pessoas - 2) * cfg.altaExtraPerPerson;
  }
  return cfg.priceTable[tipo][season];
}

function calcDiscount(nights, cfg) {
  if (nights >= 14) return cfg.discount14PlusPct / 100;
  if (nights >= 7) return cfg.discount7PlusPct / 100;
  return 0;
}

/**
 * Calcula cotacao com prorateio noite a noite e precificacao por pessoa em alta.
 * @param {object} params - { data_entrada, data_saida, pessoas, tipo }
 * @returns {object} cotacao calculada ou { error, ... }
 */
function calculateQuotation(params) {
  const cfg = getConfig();
  const { data_entrada, data_saida, pessoas, tipo } = params;

  if (!data_entrada || !data_saida || !pessoas || !tipo) {
    return { error: 'Parametros obrigatorios: data_entrada, data_saida, pessoas, tipo' };
  }

  if (tipo === 'ALA_C_GRUPO') {
    return { error: 'ALA_C_GRUPO requer atendimento humano', escalar: true };
  }

  if (!cfg.priceTable[tipo]) {
    return { error: `Tipo de quarto invalido: ${tipo}. Use: ALA_A, ALA_B, ALA_C_CASAL, ALA_C_GRUPO` };
  }

  const nights = calcNights(data_entrada, data_saida);
  if (nights <= 0) {
    return { error: 'Datas invalidas -- check-in deve ser antes do check-out' };
  }

  const numPessoas = parseInt(pessoas);

  // Validacao de minimo de noites — apenas em feriados/eventos especiais
  const entradaDate = parseDate(data_entrada);
  const entradaSeason = detectSeason(data_entrada, cfg);
  const isFeriadoStart = entradaSeason === 'feriado';
  const minNights = isFeriadoStart ? 2 : 1;

  if (nights < minNights) {
    // Identifica qual evento exige o mínimo
    const feriadoInfo = cfg.feriadoRanges.find(({ startMd, endMd }) => {
      const mm = String(entradaDate.getMonth() + 1).padStart(2, '0');
      const dd = String(entradaDate.getDate()).padStart(2, '0');
      const md = `${mm}-${dd}`;
      if (startMd <= endMd) return md >= startMd && md <= endMd;
      return md >= startMd || md <= endMd;
    });
    const reason = feriadoInfo?.label || 'este período especial';
    return {
      error: `Para ${reason}, nossa estadia mínima é de 2 noites`,
      minNights,
      suggestion: `Posso montar a cotação para 2 noites?`,
    };
  }

  // Prorateio noite a noite
  const breakdown = [];
  let totalBruto = 0;

  for (let i = 0; i < nights; i++) {
    const nightDate = addDays(entradaDate, i);
    const nightSeason = detectSeason(formatDateStr(nightDate), cfg);
    const nightPrice = calcNightPrice(tipo, nightSeason, numPessoas, cfg);
    totalBruto += nightPrice;

    const last = breakdown[breakdown.length - 1];
    if (last && last.season === nightSeason && last.price === nightPrice) {
      last.nights++;
    } else {
      breakdown.push({ season: nightSeason, price: nightPrice, nights: 1 });
    }
  }

  const descontoFrac = calcDiscount(nights, cfg);
  const totalFinal = Math.round(totalBruto * (1 - descontoFrac));
  const valorDesconto = totalBruto - totalFinal;

  return {
    data_entrada,
    data_saida,
    tipo,
    tipoLabel: cfg.tipoLabel[tipo] || tipo,
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
  const cfg = getConfig();
  const b = getBranding();

  const breakdownStr = q.breakdown.length === 1
    ? `${q.breakdown[0].nights} noite${q.breakdown[0].nights > 1 ? 's' : ''} x R$ ${q.breakdown[0].price} (${SEASON_LABEL[q.breakdown[0].season]})`
    : q.breakdown.map(p => `${p.nights} noite${p.nights > 1 ? 's' : ''} x R$ ${p.price} (${SEASON_LABEL[p.season]})`).join(' + ');

  const descontoLine = q.desconto > 0
    ? `🎁 Desconto estada longa (${q.desconto}%): -R$ ${q.valorDesconto}\n`
    : '';

  return `🌙 *Cotação — ${b.inn_name}*

📅 Check-in: ${q.data_entrada} | Check-out: ${q.data_saida}
🛏️ Tipo: ${q.tipoLabel}
👥 Hóspedes: ${q.pessoas}
🌙 Noites: ${q.nights}

💰 ${breakdownStr}
${descontoLine}💳 *Total: R$ ${q.totalFinal}*

✅ Incluso: Café da manhã, Wi-Fi
🐾 Pets: aceitos (taxa de R$${cfg.petFeePerDay}/dia por animal)
❌ Cancelamento: gratuito até 7 dias antes do check-in
📍 ${b.city} — ${b.region_label}

Responda *CONFIRMAR* para reservar e nossa equipe finaliza! 🌿`;
}

module.exports = { calculateQuotation, formatWhatsAppMessage, invalidatePricingCache };

// ─── Pacotes promocionais (generalização do PASCOA_PACKAGE) ──────────────────
// Compat: getPascoaPackage e PASCOA_PACKAGE mantêm nome e shape de retorno.

function toMd(isoDate) {
  return String(isoDate).slice(5, 10); // 'YYYY-MM-DD' → 'MM-DD'
}

/**
 * Retorna o pacote ativo cujo período cobre as datas solicitadas, ou null.
 * Shape de retorno idêntico ao PASCOA_PACKAGE atual.
 * @param {string} data_entrada - DD/MM/YYYY
 * @param {string} data_saida   - DD/MM/YYYY
 * @returns {object|null}
 */
function getPascoaPackage(data_entrada, data_saida) {
  if (!data_entrada || !data_saida) return null;

  const cfg = getConfig();
  const entrada = parseDate(data_entrada);
  const saida   = parseDate(data_saida);

  for (const pkg of cfg.packages) {
    const inicioP = new Date(pkg.startDate + 'T00:00:00');
    const fimP    = new Date(pkg.endDate + 'T00:00:00');
    if (entrada >= inicioP && saida <= fimP) {
      return {
        nome: pkg.nome,
        periodo: { startMd: toMd(pkg.startDate), endMd: toMd(pkg.endDate), ano: inicioP.getFullYear() },
        noites: pkg.noites,
        pessoas: pkg.pessoas,
        preco: pkg.preco,
        incluso: pkg.incluso,
        descricao: pkg.descricao,
      };
    }
  }
  return null;
}

// Compat: shape estático do pacote Páscoa (default), igual ao export atual
const PASCOA_PACKAGE = {
  nome: 'Escapada Romântica Páscoa',
  periodo: { startMd: '03-28', endMd: '04-06', ano: 2026 },
  noites: 2,
  pessoas: 2,
  preco: 900,
  incluso: 'Café da manhã incluso',
  descricao: '2 noites + café da manhã para 2 pessoas',
};

module.exports.getPascoaPackage = getPascoaPackage;
module.exports.PASCOA_PACKAGE   = PASCOA_PACKAGE;
