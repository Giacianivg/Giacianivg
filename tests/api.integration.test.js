'use strict';

/**
 * API Integration Tests — PLU-06.2 / PLU-06.3 / PLU-06.4 / PLU-06.5
 *
 * These tests run against a real Express app instance with a mocked Supabase client.
 * No real database connection required — tests validate route logic and response shapes.
 *
 * Run: npm run test:api
 */

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Mock Supabase before requiring server ─────────────────────────────────────
const mockData = {
  lead: { id: 'lead-uuid-001', whatsapp_number: '5519999999999', name: 'João Silva', status: 'active' },
  conversation: { id: 'conv-uuid-001' },
  proposal: { id: 'prop-uuid-001', proposal_number: 'PROP-2026-00001', status: 'pending', expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() },
  reservation: { id: 'res-uuid-001', reservation_number: 'RES-2026-00001', status: 'pending' },
  availabilityRows: [
    { date: '2026-04-10', status: 'available', room_type: 'ALA_A' },
    { date: '2026-04-11', status: 'available', room_type: 'ALA_A' },
  ],
};

// Lightweight Supabase mock — returns controlled data per test
let _mockOverride = null;
function _setMock(override) { _mockOverride = override; }  // eslint-disable-line no-unused-vars
function _clearMock() { _mockOverride = null; }  // eslint-disable-line no-unused-vars

function buildMockChain(defaultResult) {
  const result = _mockOverride || defaultResult;
  const chain = {
    select: () => chain,
    insert: () => chain,
    upsert: () => chain,
    update: () => chain,
    eq:     () => chain,
    neq:    () => chain,
    gte:    () => chain,
    lte:    () => chain,
    lt:     () => chain,
    in:     () => chain,
    order:  () => chain,
    range:  () => chain,
    limit:  () => chain,
    single: () => Promise.resolve(result),
    then:   (fn) => Promise.resolve(result).then(fn),
    [Symbol.toStringTag]: 'MockChain',
  };
  return chain;
}

// Inject mock before module loads
require.extensions['.js']  // ensure module system is active
const Module = require('module');
const origLoad = Module._load;
Module._load = function(request, _parent, _isMain) {
  if (request.includes('services/supabase/client') || request.includes('supabase/client')) {
    return {
      supabaseAdmin: {
        from: (table) => {
          const defaults = {
            leads:                 { data: mockData.lead,         error: null },
            conversations:         { data: mockData.conversation, error: null },
            proposals:             { data: mockData.proposal,     error: null },
            reservations:          { data: mockData.reservation,  error: null },
            availability:          { data: mockData.availabilityRows, error: null },
            payments:              { data: { id: 'pay-uuid-001' }, error: null },
            vw_occupancy_calendar: { data: mockData.availabilityRows, error: null },
          };
          return buildMockChain(defaults[table] || { data: [], error: null });
        },
        rpc: (name) => {
          if (name === 'create_reservation_atomic') {
            return Promise.resolve({ data: { success: true, reservation_number: 'RES-2026-00001', reservation_id: 'res-uuid-001', room_type: 'ALA_A' }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      },
      supabasePublic: {},
    };
  }
  return origLoad.apply(this, arguments);
};

// Both mocks active via Module._load override above

// ── Import server after mocks ─────────────────────────────────────────────────
const app = require('../server');

let server;
let baseUrl;

before(async () => {
  // app is not yet listening (server.js only listens when run as main module)
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  Module._load = origLoad;
  await new Promise(resolve => server.close(resolve));
});

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, body ? { ...opts, body: JSON.stringify(body) } : opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// ── Health ─────────────────────────────────────────────────────────────────────
describe('Health', () => {
  test('GET /health returns 200 with status ok', async () => {
    const { status, body } = await request('GET', '/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'pousada-crm-api');
  });
});

// ── 404 ────────────────────────────────────────────────────────────────────────
describe('404', () => {
  test('Unknown route returns 404 with structured error', async () => {
    const { status, body } = await request('GET', '/api/nonexistent');
    assert.equal(status, 404);
    assert.equal(body.success, false);
    assert.equal(body.error, 'not_found');
  });
});

// ── Leads ─────────────────────────────────────────────────────────────────────
describe('POST /api/leads/upsert', () => {
  test('Returns 400 when whatsapp_number missing', async () => {
    const { status, body } = await request('POST', '/api/leads/upsert', {});
    assert.equal(status, 400);
    assert.equal(body.success, false);
    assert.equal(body.error, 'missing_field');
  });

  test('Returns lead_id on success', async () => {
    const { status, body } = await request('POST', '/api/leads/upsert', {
      whatsapp_number: '5519999999999',
      name: 'João Silva',
    });
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(body.lead_id, 'lead_id should be present');
  });
});

// ── Conversations ─────────────────────────────────────────────────────────────
describe('POST /api/conversations', () => {
  test('Returns 400 when fields missing', async () => {
    const { status, body } = await request('POST', '/api/conversations', { role: 'user' });
    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  test('Returns 400 for invalid role', async () => {
    const { status, body } = await request('POST', '/api/conversations', {
      lead_id: 'lead-uuid-001',
      role: 'bot',
      content: 'hello',
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_role');
  });

  test('Returns 201 with conversation_id', async () => {
    const { status, body } = await request('POST', '/api/conversations', {
      lead_id: 'lead-uuid-001',
      role: 'user',
      content: 'Olá, quero uma cotação',
      message_id: 'meta-msg-001',
    });
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.ok(body.conversation_id);
  });
});

// ── Availability ──────────────────────────────────────────────────────────────
describe('GET /api/availability', () => {
  test('Returns 400 when params missing', async () => {
    const { status, body } = await request('GET', '/api/availability');
    assert.equal(status, 400);
    assert.equal(body.error, 'missing_params');
  });

  test('Returns available:true for valid request', async () => {
    const { status, body } = await request('GET',
      '/api/availability?room_type=ALA_A&checkin=10/04/2026&checkout=12/04/2026'
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok('available' in body, 'available field should be present');
  });

  test('Returns 400 for invalid room_type', async () => {
    const { status, body } = await request('GET',
      '/api/availability?room_type=SALA_X&checkin=10/04/2026&checkout=12/04/2026'
    );
    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_room_type');
  });

  test('Returns 400 when checkout before checkin', async () => {
    const { status, body } = await request('GET',
      '/api/availability?room_type=ALA_A&checkin=12/04/2026&checkout=10/04/2026'
    );
    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_range');
  });
});

// ── Proposals ─────────────────────────────────────────────────────────────────
describe('POST /api/proposals', () => {
  test('Returns 400 when fields missing', async () => {
    const { status, body } = await request('POST', '/api/proposals', {});
    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  test('Returns 400 for invalid room_type', async () => {
    const { status, body } = await request('POST', '/api/proposals', {
      lead_id: 'lead-001', room_type: 'SALA_X', checkin: '10/04/2026',
      checkout: '12/04/2026', guests: 2, total_amount: 600,
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'invalid_room_type');
  });

  test('Returns 201 with proposal_number', async () => {
    const { status, body } = await request('POST', '/api/proposals', {
      lead_id: 'lead-uuid-001', room_type: 'ALA_A', checkin: '10/04/2026',
      checkout: '12/04/2026', guests: 2, total_amount: 600,
    });
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.ok(body.proposal_number, 'proposal_number should be present');
    assert.ok(body.expires_at);
  });
});

// ── Reservations ──────────────────────────────────────────────────────────────
describe('POST /api/reservations/confirm', () => {
  test('Returns 400 when fields missing', async () => {
    const { status, body } = await request('POST', '/api/reservations/confirm', {});
    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  test('Returns 201 with reservation_number on success', async () => {
    const { status, body } = await request('POST', '/api/reservations/confirm', {
      leadId:        'lead-uuid-001',
      whatsapp:      '5519999999999',
      roomType:      'ALA_A',
      checkin:       '10/04/2026',
      checkout:      '12/04/2026',
      guests:        2,
      totalAmount:   600,
      depositAmount: 180,
    });
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.ok(body.reservation_number, 'reservation_number should be present');
  });
});

// ── Availability Calendar ─────────────────────────────────────────────────────
describe('GET /api/availability/calendar', () => {
  test('Returns 400 when params missing', async () => {
    const { status, body } = await request('GET', '/api/availability/calendar');
    assert.equal(status, 400);
    assert.equal(body.error, 'missing_params');
  });

  test('Returns calendar array on success', async () => {
    const { status, body } = await request('GET',
      '/api/availability/calendar?from=2026-04-10&to=2026-04-12'
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.calendar), 'calendar should be an array');
  });
});

// ── Availability Block/Unblock ─────────────────────────────────────────────────
describe('PATCH /api/availability/block', () => {
  test('Returns 400 when fields missing', async () => {
    const { status, body } = await request('PATCH', '/api/availability/block', {});
    assert.equal(status, 400);
    assert.equal(body.error, 'missing_fields');
  });
});

describe('PATCH /api/availability/unblock', () => {
  test('Returns 400 when fields missing', async () => {
    const { status, body } = await request('PATCH', '/api/availability/unblock', {});
    assert.equal(status, 400);
    assert.equal(body.error, 'missing_fields');
  });
});

// ── Utils ─────────────────────────────────────────────────────────────────────
describe('services/utils/dates', () => {
  const { toDB, fromDB, dateRange } = require('../services/utils/dates');

  test('toDB converts DD/MM/YYYY to YYYY-MM-DD', () => {
    assert.equal(toDB('10/04/2026'), '2026-04-10');
  });

  test('toDB passes through YYYY-MM-DD unchanged', () => {
    assert.equal(toDB('2026-04-10'), '2026-04-10');
  });

  test('fromDB converts YYYY-MM-DD to DD/MM/YYYY', () => {
    assert.equal(fromDB('2026-04-10'), '10/04/2026');
  });

  test('dateRange returns correct dates (checkout excluded)', () => {
    const dates = dateRange('2026-04-10', '2026-04-12');
    assert.deepEqual(dates, ['2026-04-10', '2026-04-11']);
  });
});

describe('services/utils/currency', () => {
  const { parseCurrency, formatCurrency } = require('../services/utils/currency');

  test('parseCurrency handles R$180,00', () => assert.equal(parseCurrency('R$180,00'), 180));
  test('parseCurrency handles R$ 1.200,50', () => assert.equal(parseCurrency('R$ 1.200,50'), 1200.50));
  test('parseCurrency handles plain number string', () => assert.equal(parseCurrency('600'), 600));
  test('parseCurrency handles number input', () => assert.equal(parseCurrency(600), 600));
  test('formatCurrency formats correctly', () => {
    assert.ok(formatCurrency(180).includes('180'));
  });
});
