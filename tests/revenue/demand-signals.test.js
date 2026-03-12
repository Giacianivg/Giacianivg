'use strict';

/**
 * Unit tests — Demand Signals
 * PLU-24 / DEC-018
 * Run: node --test tests/revenue/demand-signals.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  getSeason,
  getEventForDate,
  getEventsInRange,
  getSeasonFactor,
  estimateOccupancyFactor,
  detectPriceChanges,
  computePricePosition,
  computeSuggestedPrice,
} = require('../../services/revenue-intelligence/demand-signals');

// ─── getSeason ────────────────────────────────────────────────────────────────

describe('getSeason', () => {
  it('janeiro → alta', () => assert.equal(getSeason('2026-01-15'), 'alta'));
  it('julho → alta', ()   => assert.equal(getSeason('2026-07-10'), 'alta'));
  it('dezembro → alta', () => assert.equal(getSeason('2026-12-25'), 'alta'));

  it('sábado em abril → media', () => {
    // 2026-04-11 é sábado
    assert.equal(getSeason('2026-04-11'), 'media');
  });
  it('domingo em maio → media', () => {
    // 2026-05-03 é domingo
    assert.equal(getSeason('2026-05-03'), 'media');
  });
  it('quarta em março (fora feriado) → baixa', () => {
    // 2026-03-04 é quarta-feira
    assert.equal(getSeason('2026-03-04'), 'baixa');
  });

  it('Páscoa → alta (evento override)', () => {
    assert.equal(getSeason('2026-04-01'), 'alta');
  });
  it('EBAA → alta (evento override)', () => {
    assert.equal(getSeason('2026-06-05'), 'alta');
  });
});

// ─── getEventForDate ──────────────────────────────────────────────────────────

describe('getEventForDate', () => {
  it('retorna evento para data dentro do range', () => {
    const ev = getEventForDate('2026-02-15');
    assert.ok(ev);
    assert.ok(ev.label.includes('Carnaval'));
  });
  it('retorna null para data fora de qualquer evento', () => {
    assert.equal(getEventForDate('2026-03-01'), null);
  });
  it('retorna evento na data exata de início', () => {
    const ev = getEventForDate('2026-02-13');
    assert.ok(ev);
  });
  it('retorna evento na data exata de fim', () => {
    const ev = getEventForDate('2026-02-18');
    assert.ok(ev);
  });
});

// ─── getEventsInRange ─────────────────────────────────────────────────────────

describe('getEventsInRange', () => {
  it('retorna eventos que se sobrepõem ao período', () => {
    const evs = getEventsInRange('2026-02-01', '2026-02-28');
    assert.ok(evs.some(e => e.label.includes('Carnaval')));
  });
  it('retorna array vazio se nenhum evento no período', () => {
    const evs = getEventsInRange('2026-08-10', '2026-08-15');
    assert.equal(evs.length, 0);
  });
  it('encontra múltiplos eventos em período longo', () => {
    const evs = getEventsInRange('2026-01-01', '2026-12-31');
    assert.ok(evs.length >= 6);
  });
});

// ─── getSeasonFactor ──────────────────────────────────────────────────────────

describe('getSeasonFactor', () => {
  it('alta → 1.30', () => assert.equal(getSeasonFactor('alta'), 1.30));
  it('media → 1.10', () => assert.equal(getSeasonFactor('media'), 1.10));
  it('baixa → 1.00', () => assert.equal(getSeasonFactor('baixa'), 1.00));
  it('desconhecido → 1.00', () => assert.equal(getSeasonFactor('xyz'), 1.00));
});

// ─── estimateOccupancyFactor ──────────────────────────────────────────────────

describe('estimateOccupancyFactor', () => {
  it('alta → factor=1.20, occupancy=85', () => {
    const r = estimateOccupancyFactor('alta');
    assert.equal(r.factor, 1.20);
    assert.equal(r.occupancy_pct, 85);
  });
  it('media → factor=1.10, occupancy=65', () => {
    const r = estimateOccupancyFactor('media');
    assert.equal(r.factor, 1.10);
    assert.equal(r.occupancy_pct, 65);
  });
  it('baixa → factor=1.00, occupancy=45', () => {
    const r = estimateOccupancyFactor('baixa');
    assert.equal(r.factor, 1.00);
    assert.equal(r.occupancy_pct, 45);
  });
});

// ─── detectPriceChanges ───────────────────────────────────────────────────────

describe('detectPriceChanges', () => {
  it('detecta queda > 10%', () => {
    const curr = [{ competitor_name: 'A', price: 270, room_type: 'casal', date: '2026-07-15' }];
    const prev = [{ competitor_name: 'A', price: 350, room_type: 'casal' }];
    const changes = detectPriceChanges(curr, prev);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].direction, 'down');
    assert.ok(changes[0].change_pct < -10);
  });

  it('detecta subida > 10%', () => {
    const curr = [{ competitor_name: 'B', price: 420, room_type: 'casal', date: '2026-07-15' }];
    const prev = [{ competitor_name: 'B', price: 350, room_type: 'casal' }];
    const changes = detectPriceChanges(curr, prev);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].direction, 'up');
  });

  it('ignora variação < 10%', () => {
    const curr = [{ competitor_name: 'C', price: 355, room_type: 'casal', date: '2026-07-15' }];
    const prev = [{ competitor_name: 'C', price: 350, room_type: 'casal' }];
    const changes = detectPriceChanges(curr, prev);
    assert.equal(changes.length, 0);
  });

  it('retorna array vazio quando não há histórico anterior', () => {
    const curr = [{ competitor_name: 'D', price: 300, room_type: 'casal', date: '2026-07-15' }];
    const changes = detectPriceChanges(curr, []);
    assert.equal(changes.length, 0);
  });

  it('ignora itens sem preço', () => {
    const curr = [{ competitor_name: 'E', price: null, room_type: 'casal', date: '2026-07-15' }];
    const prev = [{ competitor_name: 'E', price: 300, room_type: 'casal' }];
    const changes = detectPriceChanges(curr, prev);
    assert.equal(changes.length, 0);
  });

  it('detecta mudanças em múltiplos concorrentes', () => {
    const curr = [
      { competitor_name: 'X', price: 200, room_type: 'casal', date: '2026-07-15' },
      { competitor_name: 'Y', price: 500, room_type: 'casal', date: '2026-07-15' },
    ];
    const prev = [
      { competitor_name: 'X', price: 350, room_type: 'casal' },
      { competitor_name: 'Y', price: 350, room_type: 'casal' },
    ];
    const changes = detectPriceChanges(curr, prev);
    assert.equal(changes.length, 2);
  });
});

// ─── computePricePosition ─────────────────────────────────────────────────────

describe('computePricePosition', () => {
  it('acima quando diff > 15%', () => {
    const r = computePricePosition(400, [300, 310, 320]);
    assert.equal(r.position, 'acima');
    assert.ok(r.diff_pct > 15);
  });

  it('abaixo quando diff < -15%', () => {
    const r = computePricePosition(250, [300, 310, 320]);
    assert.equal(r.position, 'abaixo');
    assert.ok(r.diff_pct < -15);
  });

  it('alinhado quando diff entre -15% e +15%', () => {
    const r = computePricePosition(310, [300, 310, 320]);
    assert.equal(r.position, 'alinhado');
  });

  it('sem_dados quando lista vazia', () => {
    const r = computePricePosition(300, []);
    assert.equal(r.position, 'sem_dados');
    assert.equal(r.avg, null);
  });

  it('calcula avg corretamente', () => {
    const r = computePricePosition(300, [200, 300, 400]);
    assert.equal(r.avg, 300);
  });

  it('ignora preços zero na lista', () => {
    const r = computePricePosition(300, [0, 300, 300]);
    assert.equal(r.avg, 300);
  });
});

// ─── computeSuggestedPrice ────────────────────────────────────────────────────

describe('computeSuggestedPrice', () => {
  it('retorna null quando avg não fornecido', () => {
    const r = computeSuggestedPrice(null, 'casal', 5);
    assert.equal(r, null);
  });

  it('aplica fator de alta corretamente', () => {
    // avg=300, alta: 300 * 1.30 * 1.20 = 468 → arredonda p/ 470
    const r = computeSuggestedPrice(300, 'alta', 10);
    assert.ok(r);
    assert.ok(r.suggested_price > 300);
    assert.equal(r.fator_sazonalidade, 1.30);
    assert.equal(r.fator_ocupacao, 1.20);
  });

  it('aplica fator de baixa corretamente', () => {
    // avg=300, baixa: 300 * 1.00 * 1.00 = 300
    const r = computeSuggestedPrice(300, 'baixa', 8);
    assert.equal(r.suggested_price, 300);
  });

  it('confidence_pct = (amostras / 10) * 100', () => {
    const r = computeSuggestedPrice(300, 'media', 5);
    assert.equal(r.confidence_pct, 50);
  });

  it('confidence_pct não ultrapassa 100', () => {
    const r = computeSuggestedPrice(300, 'media', 20);
    assert.equal(r.confidence_pct, 100);
  });

  it('suggested_price é múltiplo de 10', () => {
    const r = computeSuggestedPrice(285, 'media', 7);
    assert.equal(r.suggested_price % 10, 0);
  });
});
