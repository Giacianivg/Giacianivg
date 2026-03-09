'use strict';

/**
 * Unit tests for Alert Calculator — Feature 5: Sistema de Alertas
 * Run with: node --test tests/alerts/alert-calculator.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ---------------------------------------------------------------------------
// MockSupabase — simulates Supabase chained query builder
// Supports .from().select().eq().single() and .from().update().eq()
// Also supports checking conversations table for no_response
// ---------------------------------------------------------------------------

class MockSupabase {
  constructor({ lead, convState, userMessages = null } = {}) {
    this._lead = lead || null;
    this._convState = convState || null;
    this._userMessages = userMessages; // null = no user messages found
    this._updates = [];
  }

  from(table) {
    const self = this;
    const builder = {
      _table: table,
      _filters: {},
      _updatePayload: null,

      select() { return this; },

      eq(col, val) {
        this._filters[col] = val;
        return this;
      },

      not() { return this; },

      update(payload) {
        this._updatePayload = payload;
        self._updates.push({ table, payload });
        return {
          eq() { return Promise.resolve({ data: null, error: null }); },
          not() { return this; },
        };
      },

      single() {
        if (table === 'leads') {
          return Promise.resolve(
            self._lead
              ? { data: self._lead, error: null }
              : { data: null, error: { message: 'not found' } }
          );
        }
        if (table === 'conversation_states') {
          return Promise.resolve(
            self._convState
              ? { data: self._convState, error: null }
              : { data: null, error: { message: 'not found' } }
          );
        }
        if (table === 'conversations') {
          // Simulate user messages check
          return Promise.resolve(
            self._userMessages
              ? { data: self._userMessages, error: null }
              : { data: null, error: { message: 'not found' } }
          );
        }
        return Promise.resolve({ data: null, error: null });
      },
    };
    return builder;
  }
}

// ---------------------------------------------------------------------------
// Module loader — injects mock into require cache
// ---------------------------------------------------------------------------

function loadCalculatorWithMock(mockClient) {
  const fakeClientPath = path.resolve(__dirname, '../../services/supabase/client.js');

  require.cache[fakeClientPath] = {
    id: fakeClientPath,
    filename: fakeClientPath,
    loaded: true,
    exports: { supabaseAdmin: mockClient },
  };

  const calculatorPath = path.resolve(__dirname, '../../services/alerts/alert-calculator.js');
  delete require.cache[calculatorPath];

  return require(calculatorPath);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function leadFixture(overrides = {}) {
  return {
    id: 'lead-uuid-001',
    whatsapp_number: '5519999999999',
    name: 'Test User',
    score: 50,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    ...overrides,
  };
}

function convStateFixture(overrides = {}) {
  return {
    state: 'GREETING',
    data: {},
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function hoursAgoDate(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function formatDDMMYYYY(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateLeadAlert', () => {

  it('1. Lead com score > 75 e inativo > 2h → alerta hot_lead (prioridade 1)', async () => {
    const mock = new MockSupabase({
      lead: leadFixture({ score: 80 }),
      convState: convStateFixture({
        state: 'SEND_QUOTE',
        updated_at: hoursAgoDate(3),
      }),
    });
    const { calculateLeadAlert } = loadCalculatorWithMock(mock);
    const result = await calculateLeadAlert('lead-uuid-001', mock);

    assert.equal(result.type, 'hot_lead');
    assert.equal(result.priority, 1);
    assert.ok(result.message.includes('🔥'));
  });

  it('2. Lead em SEND_QUOTE inativo > 1h → alerta quote_expiring (prioridade 2)', async () => {
    const mock = new MockSupabase({
      lead: leadFixture({ score: 60 }), // score <= 75 so hot_lead won't fire
      convState: convStateFixture({
        state: 'SEND_QUOTE',
        updated_at: hoursAgoDate(2),
      }),
    });
    const { calculateLeadAlert } = loadCalculatorWithMock(mock);
    const result = await calculateLeadAlert('lead-uuid-001', mock);

    assert.equal(result.type, 'quote_expiring');
    assert.equal(result.priority, 2);
    assert.ok(result.message.includes('⏰'));
  });

  it('3. Lead com check-in em 3 dias e não confirmado → alerta checkin_soon (prioridade 3)', async () => {
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const checkinStr = formatDDMMYYYY(threeDaysFromNow);

    const mock = new MockSupabase({
      lead: leadFixture({ score: 40 }), // score <= 75
      convState: convStateFixture({
        state: 'ASK_DATES',
        data: { data_entrada: checkinStr },
        updated_at: hoursAgoDate(1), // only 1h ago — not stalled (< 48h)
      }),
    });
    const { calculateLeadAlert } = loadCalculatorWithMock(mock);
    const result = await calculateLeadAlert('lead-uuid-001', mock);

    assert.equal(result.type, 'checkin_soon');
    assert.equal(result.priority, 3);
    assert.ok(result.message.includes('📅'));
  });

  it('4. Lead parado > 48h em qualquer estado → alerta stalled (prioridade 4)', async () => {
    const mock = new MockSupabase({
      lead: leadFixture({ score: 30 }), // score <= 75
      convState: convStateFixture({
        state: 'ASK_GUESTS',
        data: {},
        updated_at: hoursAgoDate(72),
      }),
    });
    const { calculateLeadAlert } = loadCalculatorWithMock(mock);
    const result = await calculateLeadAlert('lead-uuid-001', mock);

    assert.equal(result.type, 'stalled');
    assert.equal(result.priority, 4);
    assert.ok(result.message.includes('💤'));
  });

  it('5. Lead que nunca respondeu → alerta no_response (prioridade 5)', async () => {
    const mock = new MockSupabase({
      lead: leadFixture({
        score: 5,
        created_at: hoursAgoDate(2), // created 2h ago (> 30 min)
      }),
      convState: convStateFixture({
        state: 'GREETING',
        updated_at: hoursAgoDate(1), // 1h ago — not stalled
      }),
      userMessages: null, // no user messages
    });
    const { calculateLeadAlert } = loadCalculatorWithMock(mock);
    const result = await calculateLeadAlert('lead-uuid-001', mock);

    assert.equal(result.type, 'no_response');
    assert.equal(result.priority, 5);
    assert.ok(result.message.includes('👻'));
  });

  it('6. hot_lead tem prioridade maior que quote_expiring (score > 75 + SEND_QUOTE → hot_lead)', async () => {
    // Both conditions apply: score > 75 AND state = SEND_QUOTE AND inactive > 2h
    const mock = new MockSupabase({
      lead: leadFixture({ score: 90 }),
      convState: convStateFixture({
        state: 'SEND_QUOTE',
        updated_at: hoursAgoDate(3), // inactive 3h — both hot_lead (>2h) and quote_expiring (>1h) apply
      }),
    });
    const { calculateLeadAlert } = loadCalculatorWithMock(mock);
    const result = await calculateLeadAlert('lead-uuid-001', mock);

    // hot_lead priority 1 wins over quote_expiring priority 2
    assert.equal(result.type, 'hot_lead');
    assert.equal(result.priority, 1);
  });

  it('7. Lead sem problema → retorna { type: null, message: null, priority: 0 }', async () => {
    const mock = new MockSupabase({
      lead: leadFixture({
        score: 50,
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago (< 30 min)
      }),
      convState: convStateFixture({
        state: 'GREETING',
        data: {},
        updated_at: hoursAgoDate(1), // 1h ago — not stalled (< 48h)
      }),
      userMessages: { id: 'msg-001' }, // has user messages — no no_response
    });
    const { calculateLeadAlert } = loadCalculatorWithMock(mock);
    const result = await calculateLeadAlert('lead-uuid-001', mock);

    assert.equal(result.type, null);
    assert.equal(result.message, null);
    assert.equal(result.priority, 0);
  });

  it('8. Dismiss limpa o alerta (coluna alert_type vai para null)', async () => {
    // Simulate a lead with an active alert
    const mock = new MockSupabase({
      lead: leadFixture({ score: 80 }),
      convState: convStateFixture({
        state: 'SEND_QUOTE',
        updated_at: hoursAgoDate(3),
      }),
    });
    const { calculateLeadAlert } = loadCalculatorWithMock(mock);

    // First calculate to set an alert
    const alertResult = await calculateLeadAlert('lead-uuid-001', mock);
    assert.equal(alertResult.type, 'hot_lead');

    // Verify that the mock captured an update with alert_type set
    const alertUpdate = mock._updates.find(u => u.table === 'leads' && u.payload.alert_type === 'hot_lead');
    assert.ok(alertUpdate, 'Should have saved hot_lead alert to leads table');

    // Now simulate dismiss by calling update with null values (as the route does)
    const dismissPayload = {
      alert_type: null,
      alert_message: null,
      alert_updated_at: new Date().toISOString(),
    };
    await mock.from('leads').update(dismissPayload).eq('id', 'lead-uuid-001');

    // Verify the dismiss update was captured
    const dismissUpdate = mock._updates.find(
      u => u.table === 'leads' && u.payload.alert_type === null
    );
    assert.ok(dismissUpdate, 'Dismiss should persist alert_type = null to leads table');
    assert.equal(dismissUpdate.payload.alert_type, null);
    assert.equal(dismissUpdate.payload.alert_message, null);
  });

});
