'use strict';

/**
 * Unit tests — Voucher Generator (pdf-lib)
 * PLU-12.1
 * Run: node --test tests/voucher/voucher-generator.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateVoucherPDF, fmtDate, calcNights, fmtMoney, SOURCE_LABEL, ROOM_LABEL } = require('../../services/voucher/voucher-generator');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SAMPLE_VOUCHER = {
  id:           'ab12cd34-ef56-7890-abcd-ef1234567890',
  guest_name:   'Maria Silva',
  room_type:    'ALA_B',
  check_in:     '2026-04-18',
  check_out:    '2026-04-20',
  guests:       4,
  source:       'booking',
  total_amount: 1200,
  status:       'active',
  notes:        null,
  created_at:   '2026-03-12T10:00:00Z',
};

// ─── fmtDate ─────────────────────────────────────────────────────────────────
describe('fmtDate()', () => {
  it('formata string ISO como DD/MM/YYYY', () => {
    assert.equal(fmtDate('2026-04-18'), '18/04/2026');
  });

  it('formata objeto Date', () => {
    const d = new Date('2026-12-25T12:00:00Z');
    assert.equal(fmtDate(d), '25/12/2026');
  });

  it('retorna — para valor nulo', () => {
    assert.equal(fmtDate(null), '—');
    assert.equal(fmtDate(undefined), '—');
  });
});

// ─── calcNights ───────────────────────────────────────────────────────────────
describe('calcNights()', () => {
  it('calcula 2 noites corretamente', () => {
    assert.equal(calcNights('2026-04-18', '2026-04-20'), 2);
  });

  it('calcula 7 noites', () => {
    assert.equal(calcNights('2026-04-01', '2026-04-08'), 7);
  });

  it('retorna 1 para datas iguais ou inválidas', () => {
    assert.equal(calcNights('2026-04-18', '2026-04-18'), 1);
  });
});

// ─── fmtMoney ─────────────────────────────────────────────────────────────────
describe('fmtMoney()', () => {
  it('formata R$ 1.200,00', () => {
    const result = fmtMoney(1200);
    assert.ok(result.includes('1.200') || result.includes('1200'), `Expected currency format, got: ${result}`);
    assert.ok(result.includes('R$') || result.includes('BRL'));
  });

  it('retorna — para valor nulo', () => {
    assert.equal(fmtMoney(null), '—');
    assert.equal(fmtMoney(undefined), '—');
  });
});

// ─── Labels ──────────────────────────────────────────────────────────────────
describe('SOURCE_LABEL', () => {
  it('tem todas as fontes definidas', () => {
    assert.ok(SOURCE_LABEL.direct);
    assert.ok(SOURCE_LABEL.booking);
    assert.ok(SOURCE_LABEL.expedia);
    assert.ok(SOURCE_LABEL.whatsapp);
  });

  it('booking tem label correto', () => {
    assert.equal(SOURCE_LABEL.booking, 'Reserva via Booking.com');
  });
});

describe('ROOM_LABEL', () => {
  it('tem ALA_A, ALA_B, ALA_C_CASAL, ALA_C_GRUPO', () => {
    assert.ok(ROOM_LABEL.ALA_A);
    assert.ok(ROOM_LABEL.ALA_B);
    assert.ok(ROOM_LABEL.ALA_C_CASAL);
    assert.ok(ROOM_LABEL.ALA_C_GRUPO);
  });
});

// ─── generateVoucherPDF ───────────────────────────────────────────────────────
describe('generateVoucherPDF()', () => {
  it('retorna um Buffer não-vazio', async () => {
    const buf = await generateVoucherPDF(SAMPLE_VOUCHER);
    assert.ok(buf instanceof Buffer, 'deve ser Buffer');
    assert.ok(buf.length > 1000, `PDF muito pequeno: ${buf.length} bytes`);
  });

  it('PDF começa com header %PDF', async () => {
    const buf = await generateVoucherPDF(SAMPLE_VOUCHER);
    const header = buf.slice(0, 4).toString('ascii');
    assert.equal(header, '%PDF', `Header inválido: ${header}`);
  });

  it('gera PDF com source booking', async () => {
    const buf = await generateVoucherPDF({ ...SAMPLE_VOUCHER, source: 'booking' });
    assert.ok(buf.length > 1000);
  });

  it('gera PDF com source expedia', async () => {
    const buf = await generateVoucherPDF({ ...SAMPLE_VOUCHER, source: 'expedia' });
    assert.ok(buf.length > 1000);
  });

  it('gera PDF com source direct', async () => {
    const buf = await generateVoucherPDF({ ...SAMPLE_VOUCHER, source: 'direct' });
    assert.ok(buf.length > 1000);
  });

  it('gera PDF com source whatsapp', async () => {
    const buf = await generateVoucherPDF({ ...SAMPLE_VOUCHER, source: 'whatsapp' });
    assert.ok(buf.length > 1000);
  });

  it('gera PDF para voucher cancelado', async () => {
    const buf = await generateVoucherPDF({ ...SAMPLE_VOUCHER, status: 'cancelled' });
    assert.ok(buf.length > 1000);
  });

  it('gera PDF sem valor total (total_amount null)', async () => {
    const buf = await generateVoucherPDF({ ...SAMPLE_VOUCHER, total_amount: null });
    assert.ok(buf.length > 1000);
  });

  it('gera PDF com notes', async () => {
    const buf = await generateVoucherPDF({ ...SAMPLE_VOUCHER, notes: 'Café da manhã incluído' });
    assert.ok(buf.length > 1000);
  });

  it('gera PDF com todas as acomodações', async () => {
    for (const room of ['ALA_A', 'ALA_B', 'ALA_C_CASAL', 'ALA_C_GRUPO']) {
      const buf = await generateVoucherPDF({ ...SAMPLE_VOUCHER, room_type: room });
      assert.ok(buf.length > 1000, `Falhou para ${room}`);
    }
  });
});
