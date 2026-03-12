'use strict';

/**
 * Unit tests — Competitor Prices Route (lógica de validação)
 * PLU-23 / DEC-018
 * Run: node --test tests/competitor/competitor-prices.route.test.js
 *
 * Testa validação de parâmetros e cálculo de summary sem subir servidor.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Constantes da rota ───────────────────────────────────────────────────────

const VALID_ROOM_TYPES = ['standard', 'casal', 'familia', 'grupo'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Helpers de validação (espelha lógica da rota) ────────────────────────────

function validateGetParams({ from, to, room_type }) {
  if (!from || !to) return { valid: false, error: 'missing_params' };
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return { valid: false, error: 'invalid_date' };
  if (from > to) return { valid: false, error: 'invalid_range' };
  if (room_type && !VALID_ROOM_TYPES.includes(room_type)) return { valid: false, error: 'invalid_room_type' };
  return { valid: true };
}

function validateSummaryParams({ date }) {
  if (!date || !DATE_RE.test(date)) return { valid: false, error: 'invalid_date' };
  return { valid: true };
}

function validatePostBody({ competitor_name, date, price, room_type }) {
  if (!competitor_name || !date || !price) return { valid: false, error: 'missing_fields' };
  if (!DATE_RE.test(date)) return { valid: false, error: 'invalid_date' };
  if (room_type && !VALID_ROOM_TYPES.includes(room_type)) return { valid: false, error: 'invalid_room_type' };
  const numPrice = parseFloat(price);
  if (isNaN(numPrice) || numPrice <= 0) return { valid: false, error: 'invalid_price' };
  return { valid: true };
}

function computeSummary(data, date, room_type) {
  const available = data.filter(p => p.availability && p.price > 0);
  const prices    = available.map(p => p.price);
  return {
    date,
    room_type: room_type || 'all',
    count:       prices.length,
    avg:         prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
    min:         prices.length ? Math.min(...prices) : null,
    max:         prices.length ? Math.max(...prices) : null,
    competitors: available.map(p => ({ name: p.competitor_name, price: p.price })),
  };
}

// ─── GET /api/competitor-prices (validação de parâmetros) ─────────────────────

describe('GET /api/competitor-prices — validação de parâmetros', () => {
  it('aceita from e to válidos', () => {
    const r = validateGetParams({ from: '2026-07-01', to: '2026-07-31' });
    assert.ok(r.valid);
  });

  it('rejeita quando from está ausente', () => {
    const r = validateGetParams({ to: '2026-07-31' });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'missing_params');
  });

  it('rejeita quando to está ausente', () => {
    const r = validateGetParams({ from: '2026-07-01' });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'missing_params');
  });

  it('rejeita data em formato inválido (DD/MM/YYYY)', () => {
    const r = validateGetParams({ from: '01/07/2026', to: '2026-07-31' });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'invalid_date');
  });

  it('rejeita data em formato inválido (texto)', () => {
    const r = validateGetParams({ from: 'hoje', to: '2026-07-31' });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'invalid_date');
  });

  it('rejeita quando from > to', () => {
    const r = validateGetParams({ from: '2026-07-31', to: '2026-07-01' });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'invalid_range');
  });

  it('aceita from === to (mesmo dia)', () => {
    const r = validateGetParams({ from: '2026-07-15', to: '2026-07-15' });
    assert.ok(r.valid);
  });

  it('aceita room_type válido', () => {
    const r = validateGetParams({ from: '2026-07-01', to: '2026-07-31', room_type: 'casal' });
    assert.ok(r.valid);
  });

  it('rejeita room_type inválido', () => {
    const r = validateGetParams({ from: '2026-07-01', to: '2026-07-31', room_type: 'suite' });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'invalid_room_type');
  });

  it('aceita todos os room_types válidos', () => {
    VALID_ROOM_TYPES.forEach(rt => {
      const r = validateGetParams({ from: '2026-07-01', to: '2026-07-31', room_type: rt });
      assert.ok(r.valid, `room_type ${rt} deveria ser válido`);
    });
  });
});

// ─── GET /api/competitor-prices/summary (validação) ──────────────────────────

describe('GET /api/competitor-prices/summary — validação de date', () => {
  it('aceita date YYYY-MM-DD válida', () => {
    const r = validateSummaryParams({ date: '2026-07-15' });
    assert.ok(r.valid);
  });

  it('rejeita quando date está ausente', () => {
    const r = validateSummaryParams({});
    assert.equal(r.valid, false);
    assert.equal(r.error, 'invalid_date');
  });

  it('rejeita formato inválido', () => {
    const r = validateSummaryParams({ date: '15-07-2026' });
    assert.equal(r.valid, false);
  });
});

// ─── computeSummary ───────────────────────────────────────────────────────────

describe('computeSummary — cálculo de avg/min/max', () => {
  it('calcula avg/min/max corretamente', () => {
    const data = [
      { competitor_name: 'A', price: 300, availability: true },
      { competitor_name: 'B', price: 400, availability: true },
      { competitor_name: 'C', price: 200, availability: true },
    ];
    const s = computeSummary(data, '2026-07-15', 'casal');
    assert.equal(s.count, 3);
    assert.equal(s.avg, 300);
    assert.equal(s.min, 200);
    assert.equal(s.max, 400);
    assert.equal(s.room_type, 'casal');
  });

  it('exclui registros com availability=false', () => {
    const data = [
      { competitor_name: 'A', price: 300, availability: true },
      { competitor_name: 'B', price: 400, availability: false },
    ];
    const s = computeSummary(data, '2026-07-15');
    assert.equal(s.count, 1);
    assert.equal(s.avg, 300);
  });

  it('exclui registros com price=0', () => {
    const data = [
      { competitor_name: 'A', price: 300, availability: true },
      { competitor_name: 'B', price: 0, availability: true },
    ];
    const s = computeSummary(data, '2026-07-15');
    assert.equal(s.count, 1);
  });

  it('retorna null para avg/min/max quando não há dados', () => {
    const s = computeSummary([], '2026-07-15');
    assert.equal(s.count, 0);
    assert.equal(s.avg, null);
    assert.equal(s.min, null);
    assert.equal(s.max, null);
  });

  it('lista competitors com nome e preço', () => {
    const data = [
      { competitor_name: 'Pousada X', price: 350, availability: true },
    ];
    const s = computeSummary(data, '2026-07-15');
    assert.equal(s.competitors.length, 1);
    assert.equal(s.competitors[0].name, 'Pousada X');
    assert.equal(s.competitors[0].price, 350);
  });

  it('usa room_type=all quando não informado', () => {
    const s = computeSummary([], '2026-07-15');
    assert.equal(s.room_type, 'all');
  });

  it('arredonda avg para inteiro (Math.round)', () => {
    const data = [
      { competitor_name: 'A', price: 300, availability: true },
      { competitor_name: 'B', price: 301, availability: true },
    ];
    const s = computeSummary(data, '2026-07-15');
    assert.equal(s.avg, 301); // Math.round(300.5) = 301
  });
});

// ─── POST /api/competitor-prices (validação de body) ─────────────────────────

describe('POST /api/competitor-prices — validação de body', () => {
  it('aceita payload completo válido', () => {
    const r = validatePostBody({
      competitor_name: 'Pousada Pompeia',
      date: '2026-07-15',
      price: '320',
      room_type: 'casal',
    });
    assert.ok(r.valid);
  });

  it('aceita sem room_type (opcional)', () => {
    const r = validatePostBody({
      competitor_name: 'Pousada Pompeia',
      date: '2026-07-15',
      price: 280,
    });
    assert.ok(r.valid);
  });

  it('rejeita quando competitor_name está ausente', () => {
    const r = validatePostBody({ date: '2026-07-15', price: 300 });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'missing_fields');
  });

  it('rejeita quando date está ausente', () => {
    const r = validatePostBody({ competitor_name: 'X', price: 300 });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'missing_fields');
  });

  it('rejeita quando price está ausente', () => {
    const r = validatePostBody({ competitor_name: 'X', date: '2026-07-15' });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'missing_fields');
  });

  it('rejeita date inválida', () => {
    const r = validatePostBody({ competitor_name: 'X', date: '15/07/2026', price: 300 });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'invalid_date');
  });

  it('rejeita room_type inválido', () => {
    const r = validatePostBody({ competitor_name: 'X', date: '2026-07-15', price: 300, room_type: 'loft' });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'invalid_room_type');
  });

  it('rejeita price negativo', () => {
    const r = validatePostBody({ competitor_name: 'X', date: '2026-07-15', price: -50 });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'invalid_price');
  });

  it('rejeita price zero (falsy → missing_fields)', () => {
    const r = validatePostBody({ competitor_name: 'X', date: '2026-07-15', price: 0 });
    assert.equal(r.valid, false);
    // price=0 é falsy → dispara missing_fields antes do invalid_price check
    assert.equal(r.error, 'missing_fields');
  });

  it('rejeita price não-numérico', () => {
    const r = validatePostBody({ competitor_name: 'X', date: '2026-07-15', price: 'gratis' });
    assert.equal(r.valid, false);
    assert.equal(r.error, 'invalid_price');
  });

  it('aceita price como número float', () => {
    const r = validatePostBody({ competitor_name: 'X', date: '2026-07-15', price: 299.99 });
    assert.ok(r.valid);
  });
});
