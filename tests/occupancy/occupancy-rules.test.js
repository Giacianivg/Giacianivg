'use strict';

/**
 * Regressão — Regras canônicas de ocupação (DEC-024)
 * Run: node --test tests/occupancy/occupancy-rules.test.js
 *
 * Cobre os 4 pontos da divergência diagnosticada:
 *   1. Fronteira de checkout (dia do checkout = livre)
 *   2. Exclusão de checkedout das contagens do dia
 *   3. Fuso BR para "hoje"
 *   4. Saldo com consumo
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../services/occupancy/rules');

// ─── 1. Fronteira de checkout ──────────────────────────────────────────────
describe('Fronteira de checkout — checkin <= dia < checkout', () => {
  const ci = '2026-07-13', co = '2026-07-18';

  it('ocupa o dia do check-in', () => {
    assert.equal(R.isOccupiedNight(ci, co, '2026-07-13'), true);
  });
  it('ocupa noites intermediárias', () => {
    assert.equal(R.isOccupiedNight(ci, co, '2026-07-15'), true);
  });
  it('ocupa a última noite (checkout − 1)', () => {
    assert.equal(R.isOccupiedNight(ci, co, '2026-07-17'), true);
  });
  it('NÃO ocupa o dia do checkout (livre para vender)', () => {
    assert.equal(R.isOccupiedNight(ci, co, '2026-07-18'), false);
  });
  it('NÃO ocupa antes do check-in', () => {
    assert.equal(R.isOccupiedNight(ci, co, '2026-07-12'), false);
  });

  it('isInHouse: hoje no meio da estadia e status ativo', () => {
    assert.equal(R.isInHouse('checkedin', ci, co, '2026-07-15'), true);
  });
  it('isInHouse: false no dia do checkout (já não ocupa)', () => {
    assert.equal(R.isInHouse('checkedin', ci, co, '2026-07-18'), false);
  });
});

// ─── 2. Exclusão de checkedout ─────────────────────────────────────────────
describe('Exclusão de checkedout das contagens do dia', () => {
  const today = '2026-07-18';

  it('checkout do dia conta para confirmed', () => {
    assert.equal(R.isCheckoutToday('confirmed', today, today), true);
  });
  it('checkout do dia conta para checkedin', () => {
    assert.equal(R.isCheckoutToday('checkedin', today, today), true);
  });
  it('checkout do dia NÃO conta quando já fez check-out (checkedout)', () => {
    assert.equal(R.isCheckoutToday('checkedout', today, today), false);
  });
  it('checkout do dia NÃO conta quando cancelado', () => {
    assert.equal(R.isCheckoutToday('cancelled', today, today), false);
  });
  it('checkedout não é status de ocupação ativa', () => {
    assert.equal(R.isActiveOccupancy('checkedout'), false);
  });
  it('in-house exclui checkedout mesmo dentro da janela de datas', () => {
    assert.equal(R.isInHouse('checkedout', '2026-07-13', '2026-07-20', '2026-07-15'), false);
  });
  it('check-in do dia inclui pending (reserva nasce pending no CRM)', () => {
    assert.equal(R.isCheckinToday('pending', today, today), true);
  });
});

// ─── 3. Fuso BR ────────────────────────────────────────────────────────────
describe('"Hoje" em America/Sao_Paulo', () => {
  it('retorna formato YYYY-MM-DD', () => {
    assert.match(R.todayBR(), /^\d{4}-\d{2}-\d{2}$/);
  });
  it('23h30 UTC de 16/06 ainda é 16/06 no Brasil (UTC-3), não 17/06', () => {
    // 2026-06-16T23:30Z = 2026-06-16 20:30 em São Paulo
    assert.equal(R.todayBR(new Date('2026-06-16T23:30:00Z')), '2026-06-16');
  });
  it('02h00 UTC de 17/06 ainda é 16/06 no Brasil (UTC-3)', () => {
    // 2026-06-17T02:00Z = 2026-06-16 23:00 em São Paulo
    assert.equal(R.todayBR(new Date('2026-06-17T02:00:00Z')), '2026-06-16');
  });
  it('12h00 UTC de 17/06 é 17/06 no Brasil', () => {
    assert.equal(R.todayBR(new Date('2026-06-17T12:00:00Z')), '2026-06-17');
  });
});

// ─── 4. Saldo com consumo ──────────────────────────────────────────────────
describe('Saldo e total pago', () => {
  it('balanceDue = total + consumo − sinal − pagamentos', () => {
    assert.equal(R.balanceDue({ room_total: 400, charges_total: 16, deposit_paid: 120, payments_confirmed: 0 }), 296);
  });
  it('balanceDue zero quando tudo pago', () => {
    assert.equal(R.balanceDue({ room_total: 300, charges_total: 65, deposit_paid: 90, payments_confirmed: 275 }), 0);
  });
  it('balanceDue ignora consumo ausente', () => {
    assert.equal(R.balanceDue({ room_total: 100, deposit_paid: 30 }), 70);
  });
  it('totalPaid = sinal + pagamentos confirmados', () => {
    assert.equal(R.totalPaid({ deposit_paid: 120, payments_confirmed: 176 }), 296);
  });
  it('totalPaid com campos ausentes = 0', () => {
    assert.equal(R.totalPaid({}), 0);
  });
});
