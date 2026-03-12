'use strict';

/**
 * Unit tests — Competitor Scraper helpers
 * PLU-23 / DEC-018
 * Run: node --test tests/competitor/scraper.test.js
 *
 * Pure unit tests — sem HTTP, sem Supabase, sem Apify.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  parsePrice,
  normalizeDate,
  mapRoomType,
  getSeasonPrice,
  addDaysISO,
  parsePriceData,
  generateMockPrices,
} = require('../../services/competitor/scraper');

// ─── parsePrice ───────────────────────────────────────────────────────────────

describe('parsePrice', () => {
  it('aceita número positivo', () => {
    assert.equal(parsePrice(350), 350);
  });
  it('aceita string numérica', () => {
    assert.equal(parsePrice('280'), 280);
  });
  it('remove prefixo R$', () => {
    assert.equal(parsePrice('R$400'), 400);
  });
  it('retorna null para zero', () => {
    assert.equal(parsePrice(0), null);
  });
  it('retorna null para negativo', () => {
    assert.equal(parsePrice(-10), null);
  });
  it('retorna null para null', () => {
    assert.equal(parsePrice(null), null);
  });
  it('retorna null para undefined', () => {
    assert.equal(parsePrice(undefined), null);
  });
  it('retorna null para string vazia', () => {
    assert.equal(parsePrice(''), null);
  });
  it('retorna null para NaN string', () => {
    assert.equal(parsePrice('abc'), null);
  });
  it('aceita valor decimal', () => {
    assert.equal(parsePrice('299.90'), 299.90);
  });
});

// ─── normalizeDate ────────────────────────────────────────────────────────────

describe('normalizeDate', () => {
  it('aceita ISO YYYY-MM-DD', () => {
    assert.equal(normalizeDate('2026-07-15'), '2026-07-15');
  });
  it('aceita ISO embutido em timestamp', () => {
    assert.equal(normalizeDate('2026-07-15T14:00:00Z'), '2026-07-15');
  });
  it('converte DD/MM/YYYY para YYYY-MM-DD', () => {
    assert.equal(normalizeDate('15/07/2026'), '2026-07-15');
  });
  it('retorna null para null', () => {
    assert.equal(normalizeDate(null), null);
  });
  it('retorna null para string inválida', () => {
    assert.equal(normalizeDate('naoehdata'), null);
  });
  it('retorna null para undefined', () => {
    assert.equal(normalizeDate(undefined), null);
  });
});

// ─── mapRoomType ──────────────────────────────────────────────────────────────

describe('mapRoomType', () => {
  it('capacidade 1 → casal', () => {
    assert.equal(mapRoomType(1), 'casal');
  });
  it('capacidade 2 → casal', () => {
    assert.equal(mapRoomType(2), 'casal');
  });
  it('capacidade 3 → standard', () => {
    assert.equal(mapRoomType(3), 'standard');
  });
  it('capacidade 4 → familia', () => {
    assert.equal(mapRoomType(4), 'familia');
  });
  it('capacidade 6 → familia', () => {
    assert.equal(mapRoomType(6), 'familia');
  });
  it('capacidade 7 → grupo', () => {
    assert.equal(mapRoomType(7), 'grupo');
  });
  it('capacidade 10 → grupo', () => {
    assert.equal(mapRoomType(10), 'grupo');
  });
});

// ─── getSeasonPrice ───────────────────────────────────────────────────────────

describe('getSeasonPrice', () => {
  it('janeiro → alta (400)', () => {
    assert.equal(getSeasonPrice('2026-01-10'), 400);
  });
  it('julho → alta (400)', () => {
    assert.equal(getSeasonPrice('2026-07-10'), 400);
  });
  it('dezembro → alta (400)', () => {
    assert.equal(getSeasonPrice('2026-12-25'), 400);
  });
  it('sábado em abril → media (320)', () => {
    // 2026-04-11 é sábado
    assert.equal(getSeasonPrice('2026-04-11'), 320);
  });
  it('domingo em maio → media (320)', () => {
    // 2026-05-03 é domingo
    assert.equal(getSeasonPrice('2026-05-03'), 320);
  });
  it('quarta-feira em março → baixa (280)', () => {
    // 2026-03-04 é quarta
    assert.equal(getSeasonPrice('2026-03-04'), 280);
  });
});

// ─── addDaysISO ───────────────────────────────────────────────────────────────

describe('addDaysISO', () => {
  it('soma 1 dia', () => {
    assert.equal(addDaysISO('2026-03-31', 1), '2026-04-01');
  });
  it('soma 0 dias → mesmo dia', () => {
    assert.equal(addDaysISO('2026-06-15', 0), '2026-06-15');
  });
  it('soma 30 dias', () => {
    assert.equal(addDaysISO('2026-03-01', 30), '2026-03-31');
  });
  it('volta 1 dia (n negativo)', () => {
    assert.equal(addDaysISO('2026-04-01', -1), '2026-03-31');
  });
});

// ─── parsePriceData ───────────────────────────────────────────────────────────

describe('parsePriceData', () => {
  const from = '2026-07-01';
  const to   = '2026-07-31';
  const name = 'Pousada Teste';
  const url  = 'https://booking.com/test';

  it('retorna array vazio para items vazio', () => {
    const result = parsePriceData([], name, url, from, to);
    assert.equal(result.length, 0);
  });

  it('retorna array vazio para items não-array', () => {
    const result = parsePriceData(null, name, url, from, to);
    assert.equal(result.length, 0);
  });

  it('parseia item com campo price e checkIn', () => {
    const items = [{ price: 320, checkIn: '2026-07-15', maxOccupancy: 2 }];
    const result = parsePriceData(items, name, url, from, to);
    assert.equal(result.length, 1);
    assert.equal(result[0].price, 320);
    assert.equal(result[0].date, '2026-07-15');
    assert.equal(result[0].room_type, 'casal');
    assert.equal(result[0].competitor_name, name);
    assert.equal(result[0].source, 'apify');
  });

  it('parseia item com campo pricePerNight', () => {
    const items = [{ pricePerNight: 280, checkIn: '2026-07-10' }];
    const result = parsePriceData(items, name, url, from, to);
    assert.equal(result.length, 1);
    assert.equal(result[0].price, 280);
  });

  it('parseia item com cheapestOffer.price', () => {
    const items = [{ cheapestOffer: { price: 350 }, checkIn: '2026-07-20' }];
    const result = parsePriceData(items, name, url, from, to);
    assert.equal(result.length, 1);
    assert.equal(result[0].price, 350);
  });

  it('ignora item sem preço', () => {
    const items = [{ checkIn: '2026-07-10' }];
    const result = parsePriceData(items, name, url, from, to);
    assert.equal(result.length, 0);
  });

  it('ignora item com data fora do período', () => {
    const items = [{ price: 300, checkIn: '2026-08-01' }];
    const result = parsePriceData(items, name, url, from, to);
    assert.equal(result.length, 0);
  });

  it('usa dateFrom quando data ausente no item', () => {
    const items = [{ price: 310, maxOccupancy: 4 }];
    const result = parsePriceData(items, name, url, from, to);
    assert.equal(result.length, 1);
    assert.equal(result[0].date, from);
    assert.equal(result[0].room_type, 'familia');
  });

  it('mapeia capacidade 6 → familia', () => {
    const items = [{ price: 400, checkIn: '2026-07-05', adults: 6 }];
    const result = parsePriceData(items, name, url, from, to);
    assert.equal(result[0].room_type, 'familia');
  });

  it('mapeia capacidade 8 → grupo', () => {
    const items = [{ price: 500, checkIn: '2026-07-05', guests: 8 }];
    const result = parsePriceData(items, name, url, from, to);
    assert.equal(result[0].room_type, 'grupo');
  });
});

// ─── generateMockPrices ───────────────────────────────────────────────────────

describe('generateMockPrices', () => {
  const from = '2026-07-01';
  const to   = '2026-07-03';
  const name = 'Pousada Mock';
  const url  = 'https://booking.com/mock';

  it('gera uma entrada por dia no período', () => {
    const result = generateMockPrices(name, url, from, to);
    assert.equal(result.length, 3);
  });

  it('cada item tem campos obrigatórios', () => {
    const result = generateMockPrices(name, url, from, to);
    result.forEach(item => {
      assert.ok(item.date, 'date ausente');
      assert.ok(item.price > 0, 'price inválido');
      assert.equal(item.competitor_name, name);
      assert.equal(item.competitor_url, url);
      assert.equal(item.platform, 'booking');
      assert.equal(item.room_type, 'casal');
      assert.equal(item.source, 'apify');
      assert.ok(typeof item.availability === 'boolean', 'availability deve ser boolean');
    });
  });

  it('primeiro item tem date igual a from', () => {
    const result = generateMockPrices(name, url, from, to);
    assert.equal(result[0].date, from);
  });

  it('último item tem date igual a to', () => {
    const result = generateMockPrices(name, url, from, to);
    assert.equal(result[result.length - 1].date, to);
  });

  it('preços ficam na faixa razoável (100–800)', () => {
    const result = generateMockPrices(name, url, '2026-07-01', '2026-07-31');
    result.forEach(item => {
      assert.ok(item.price >= 100 && item.price <= 800, `preço fora da faixa: ${item.price}`);
    });
  });

  it('período único retorna 1 item', () => {
    const result = generateMockPrices(name, url, '2026-07-15', '2026-07-15');
    assert.equal(result.length, 1);
  });
});
