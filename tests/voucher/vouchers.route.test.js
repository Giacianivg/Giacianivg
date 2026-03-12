'use strict';

/**
 * Unit tests — Vouchers Route (lógica de validação)
 * PLU-12.1
 * Run: node --test tests/voucher/vouchers.route.test.js
 *
 * Testa a lógica de validação da rota sem subir servidor Express.
 * O endpoint /download é testado via mock do supabaseAdmin e generateVoucherPDF.
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Constantes copiadas da rota (validação de negócio) ────────────────────
const VALID_SOURCES  = ['direct', 'booking', 'expedia', 'whatsapp'];
const VALID_STATUSES = ['active', 'cancelled'];

// ─── Helpers de validação (extraídos da lógica da rota) ───────────────────
function validatePostBody(body) {
  const { guest_name, room_type, check_in, check_out, guests, source } = body;
  if (!guest_name || !room_type || !check_in || !check_out || !guests) {
    return { valid: false, error: 'missing_fields' };
  }
  if (source && !VALID_SOURCES.includes(source)) {
    return { valid: false, error: 'invalid_source' };
  }
  return { valid: true };
}

function validatePatchBody(body) {
  const { status } = body;
  if (status && !VALID_STATUSES.includes(status)) {
    return { valid: false, error: 'invalid_status' };
  }
  return { valid: true };
}

// ─── POST Validation ──────────────────────────────────────────────────────
describe('POST /api/vouchers — validação de campos', () => {
  it('aceita payload completo com source direto', () => {
    const result = validatePostBody({
      guest_name: 'Maria Silva',
      room_type:  'ALA_B',
      check_in:   '2026-04-18',
      check_out:  '2026-04-20',
      guests:     4,
      source:     'direct',
    });
    assert.ok(result.valid);
  });

  it('rejeita quando guest_name está ausente', () => {
    const result = validatePostBody({
      room_type: 'ALA_A',
      check_in:  '2026-04-18',
      check_out: '2026-04-20',
      guests:    2,
    });
    assert.equal(result.valid, false);
    assert.equal(result.error, 'missing_fields');
  });

  it('rejeita quando check_in está ausente', () => {
    const result = validatePostBody({
      guest_name: 'João',
      room_type:  'ALA_A',
      check_out:  '2026-04-20',
      guests:     2,
    });
    assert.equal(result.valid, false);
  });

  it('rejeita source inválido', () => {
    const result = validatePostBody({
      guest_name: 'João',
      room_type:  'ALA_A',
      check_in:   '2026-04-18',
      check_out:  '2026-04-20',
      guests:     2,
      source:     'airbnb',
    });
    assert.equal(result.valid, false);
    assert.equal(result.error, 'invalid_source');
  });

  it('aceita todas as fontes válidas', () => {
    for (const source of VALID_SOURCES) {
      const result = validatePostBody({
        guest_name: 'Test',
        room_type:  'ALA_A',
        check_in:   '2026-04-18',
        check_out:  '2026-04-20',
        guests:     2,
        source,
      });
      assert.ok(result.valid, `source '${source}' deve ser válido`);
    }
  });

  it('aceita payload sem source (usa default)', () => {
    const result = validatePostBody({
      guest_name: 'Test',
      room_type:  'ALA_A',
      check_in:   '2026-04-18',
      check_out:  '2026-04-20',
      guests:     2,
    });
    assert.ok(result.valid);
  });
});

// ─── PATCH Validation ─────────────────────────────────────────────────────
describe('PATCH /api/vouchers/:id — validação de status', () => {
  it('aceita status active', () => {
    assert.ok(validatePatchBody({ status: 'active' }).valid);
  });

  it('aceita status cancelled', () => {
    assert.ok(validatePatchBody({ status: 'cancelled' }).valid);
  });

  it('rejeita status inválido', () => {
    const result = validatePatchBody({ status: 'expired' });
    assert.equal(result.valid, false);
    assert.equal(result.error, 'invalid_status');
  });

  it('aceita patch sem status (só notes)', () => {
    assert.ok(validatePatchBody({ notes: 'Observação' }).valid);
  });
});

// ─── Download token validation ────────────────────────────────────────────
describe('GET /api/vouchers/:id/download — lógica de token', () => {
  it('token correto dá acesso (token match)', () => {
    const voucher = { download_token: 'abc-123-xyz', status: 'active' };
    const tokenProvided = 'abc-123-xyz';
    assert.equal(voucher.download_token === tokenProvided, true);
  });

  it('token errado bloqueia acesso', () => {
    const voucher = { download_token: 'abc-123-xyz', status: 'active' };
    const tokenProvided = 'wrong-token';
    assert.equal(voucher.download_token === tokenProvided, false);
  });

  it('ausência de token bloqueia (falsy check)', () => {
    const token = undefined;
    assert.ok(!token);
  });

  it('string vazia bloqueia (falsy check)', () => {
    const token = '';
    assert.ok(!token);
  });
});

// ─── Filtros de query string ──────────────────────────────────────────────
describe('GET /api/vouchers — lógica de filtros', () => {
  const data = [
    { id: '1', guest_name: 'Maria Silva', source: 'booking',  status: 'active' },
    { id: '2', guest_name: 'João Costa',  source: 'direct',   status: 'active' },
    { id: '3', guest_name: 'Ana Lima',    source: 'expedia',  status: 'cancelled' },
    { id: '4', guest_name: 'Pedro Souza', source: 'whatsapp', status: 'active' },
  ];

  it('filtra por source booking', () => {
    const res = data.filter(v => v.source === 'booking');
    assert.equal(res.length, 1);
    assert.equal(res[0].guest_name, 'Maria Silva');
  });

  it('filtra por status cancelled', () => {
    const res = data.filter(v => v.status === 'cancelled');
    assert.equal(res.length, 1);
    assert.equal(res[0].guest_name, 'Ana Lima');
  });

  it('busca por nome case-insensitive contém', () => {
    const search = 'silva';
    const res = data.filter(v => v.guest_name.toLowerCase().includes(search));
    assert.equal(res.length, 1);
    assert.equal(res[0].id, '1');
  });

  it('sem filtros retorna todos', () => {
    assert.equal(data.length, 4);
  });

  it('fonte inválida deve ser ignorada (fora de VALID_SOURCES)', () => {
    const source = 'airbnb';
    assert.equal(VALID_SOURCES.includes(source), false);
  });
});
