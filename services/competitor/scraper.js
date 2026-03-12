'use strict';

/**
 * Competitor Price Scraper — PLU-23 / DEC-018
 *
 * Busca preços dos concorrentes via Apify REST API (Booking.com).
 * Usa native fetch (Node.js 18+) — sem dependências extras.
 *
 * Env vars:
 *   APIFY_API_TOKEN        — token Apify (obrigatório em produção)
 *   APIFY_ACTOR_BOOKING    — actor ID (default: 'voyager/booking-com')
 *
 * Modo dry-run: se APIFY_API_TOKEN não estiver definido, retorna preços simulados.
 * Útil para desenvolvimento e testes sem créditos Apify.
 */

const { supabaseAdmin } = require('../supabase/client');
const COMPETITORS = require('./competitors');

const APIFY_TOKEN     = process.env.APIFY_API_TOKEN;
const APIFY_ACTOR     = process.env.APIFY_ACTOR_BOOKING || 'voyager/booking-com';
const APIFY_BASE      = 'https://api.apify.com/v2';
const SCRAPE_DAYS     = 60; // dias à frente para scraping

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Roda o scraping de todos os concorrentes.
 * @returns {{ scraped: number, failed: number, saved: number, errors: string[] }}
 */
async function runDailyScrape() {
  const dateFrom = todayISO();
  const dateTo   = addDaysISO(dateFrom, SCRAPE_DAYS);

  const report = { scraped: 0, failed: 0, saved: 0, errors: [] };

  for (const competitor of COMPETITORS) {
    try {
      const prices = await scrapeOne(competitor, dateFrom, dateTo);
      const saved  = await savePrices(prices, competitor);
      report.scraped++;
      report.saved += saved;
    } catch (err) {
      report.failed++;
      report.errors.push(`${competitor.name}: ${err.message}`);
      console.error(`[scraper] FAILED ${competitor.name}:`, err.message);
    }
  }

  console.log(`[scraper] Done — scraped:${report.scraped} failed:${report.failed} saved:${report.saved}`);
  return report;
}

// ─── Scrape single competitor ─────────────────────────────────────────────────

async function scrapeOne(competitor, dateFrom, dateTo) {
  if (!APIFY_TOKEN) {
    console.log(`[scraper] dry-run — mock prices for ${competitor.name}`);
    return generateMockPrices(competitor.name, competitor.url, dateFrom, dateTo);
  }

  const actorId = encodeURIComponent(APIFY_ACTOR);
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120&memory=512`;

  const body = {
    startUrls: [{ url: competitor.url }],
    checkIn:   dateFrom,
    checkOut:  dateTo,
    currency:  'BRL',
    language:  'pt-br',
    maxItems:  1,
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Apify HTTP ${res.status}: ${text.slice(0, 120)}`);
  }

  const items = await res.json();
  return parsePriceData(items, competitor.name, competitor.url, dateFrom, dateTo);
}

// ─── Parse Apify response ─────────────────────────────────────────────────────

/**
 * Parseia resposta do Apify para array de preços por data.
 * Suporta múltiplos formatos de resposta de diferentes atores.
 */
function parsePriceData(items, competitorName, competitorUrl, dateFrom, dateTo) {
  if (!Array.isArray(items) || !items.length) return [];

  const prices = [];

  items.forEach(item => {
    // Tenta extrair o preço de diferentes campos possíveis
    const rawPrice = item.price ?? item.pricePerNight ?? item.minPrice
      ?? item.cheapestOffer?.price ?? item.offers?.[0]?.price ?? null;

    const price = parsePrice(rawPrice);
    if (!price) return;

    // Tenta extrair a data (check-in) de diferentes campos
    const dateStr = item.checkIn ?? item.checkin ?? item.date ?? item.arrivalDate ?? dateFrom;
    const date    = normalizeDate(dateStr);
    if (!date) return;

    // Só inclui datas dentro do período solicitado
    if (date < dateFrom || date > dateTo) return;

    // Mapeia tipo de quarto
    const capacity = item.maxOccupancy ?? item.guests ?? item.adults ?? 2;
    const roomType = mapRoomType(capacity);

    prices.push({
      competitor_name: competitorName,
      competitor_url:  competitorUrl,
      platform:        'booking',
      date,
      price,
      room_type:       roomType,
      availability:    true,
      source:          'apify',
    });
  });

  return prices;
}

// ─── Save to Supabase ─────────────────────────────────────────────────────────

async function savePrices(prices, competitor) {
  if (!prices.length) return 0;

  // Deleta os preços antigos do mesmo concorrente para o mesmo período
  const dates = [...new Set(prices.map(p => p.date))];
  if (dates.length) {
    await supabaseAdmin
      .from('competitor_prices')
      .delete()
      .eq('competitor_name', competitor.name)
      .in('date', dates)
      .eq('source', 'apify');
  }

  // Insere os novos preços em batch
  const { error } = await supabaseAdmin
    .from('competitor_prices')
    .insert(prices);

  if (error) throw new Error(`Supabase insert: ${error.message}`);
  return prices.length;
}

// ─── Mock prices (dry-run / testing) ─────────────────────────────────────────

/**
 * Gera preços simulados para desenvolvimento sem token Apify.
 * Usa sazonalidade similar à pousada mas com ±20% de variação.
 */
function generateMockPrices(competitorName, competitorUrl, dateFrom, dateTo) {
  const prices = [];
  let current  = dateFrom;

  while (current <= dateTo) {
    const base   = getSeasonPrice(current);
    const jitter = 0.8 + Math.random() * 0.4; // 80%–120%
    const price  = Math.round(base * jitter / 10) * 10;

    prices.push({
      competitor_name: competitorName,
      competitor_url:  competitorUrl,
      platform:        'booking',
      date:            current,
      price,
      room_type:       'casal',
      availability:    Math.random() > 0.1,
      source:          'apify',
    });

    current = addDaysISO(current, 1);
  }

  return prices;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(raw) {
  if (!raw && raw !== 0) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(n) || n <= 0 ? null : n;
}

function normalizeDate(str) {
  if (!str) return null;
  const match = String(str).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[0];
  // Tenta DD/MM/YYYY
  const brMatch = String(str).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return null;
}

function mapRoomType(capacity) {
  if (capacity <= 2) return 'casal';
  if (capacity <= 3) return 'standard';
  if (capacity <= 6) return 'familia';
  return 'grupo';
}

function getSeasonPrice(dateISO) {
  const [, m] = dateISO.split('-').map(Number);
  const dow = new Date(dateISO + 'T12:00:00').getDay();
  if (m === 1 || m === 7 || m === 12) return 400;
  if (dow === 0 || dow === 6) return 320;
  return 280;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO, n) {
  const d = new Date(dateISO + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  runDailyScrape,
  scrapeOne,
  parsePriceData,
  generateMockPrices,
  // export helpers for testing
  parsePrice,
  normalizeDate,
  mapRoomType,
  getSeasonPrice,
  addDaysISO,
};
