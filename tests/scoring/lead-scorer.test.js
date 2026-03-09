'use strict';

/**
 * Unit tests for Lead Scorer — Feature 1: Lead Scoring Automático
 * Run with: node --test tests/scoring/lead-scorer.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// MockSupabase — simulates Supabase chained query builder
// ---------------------------------------------------------------------------
class MockQueryBuilder {
  constructor(result) {
    this._result = result;
  }
  select() { return this; }
  eq() { return this; }
  update() { return this; }
  single() { return Promise.resolve(this._result); }
  then(resolve) { return Promise.resolve(this._result).then(resolve); }
}

class MockSupabase {
  constructor({ lead, convState } = {}) {
    this._lead = lead || null;
    this._convState = convState || null;
    this._updates = [];
  }

  from(table) {
    const self = this;
    return {
      _table: table,
      select() { return this; },
      eq() { return this; },
      update(payload) {
        self._updates.push({ table, payload });
        return {
          eq() { return Promise.resolve({ data: null, error: null }); },
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
        return Promise.resolve({ data: null, error: null });
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Import the function under test — override supabaseAdmin dependency
// We temporarily hijack the require cache.
// ---------------------------------------------------------------------------
const Module = require('module');
const path = require('path');

function loadScorerWithMock(mockClient) {
  // Build fake supabase module path as it would be resolved from services/scoring/
  const fakeClientPath = path.resolve(__dirname, '../../services/supabase/client.js');

  // Inject mock into require cache
  require.cache[fakeClientPath] = {
    id: fakeClientPath,
    filename: fakeClientPath,
    loaded: true,
    exports: { supabaseAdmin: mockClient },
  };

  // Clear lead-scorer from cache so it re-requires with our mock
  const scorerPath = path.resolve(__dirname, '../../services/scoring/lead-scorer.js');
  delete require.cache[scorerPath];

  return require(scorerPath);
}

// ---------------------------------------------------------------------------
// Helper: build a mock state with updated_at = now (active lead)
// ---------------------------------------------------------------------------
function freshState(overrides = {}) {
  return {
    state: 'GREETING',
    data: {},
    metadata: {},
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function leadFixture(overrides = {}) {
  return {
    id: 'lead-uuid-001',
    whatsapp_number: '5519999999999',
    name: 'Test User',
    funnel_stage: 'new',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateLeadScore', () => {

  it('1. CONFIRM_BOOKING + nome → score 90+5=95, label hot', async () => {
    const mock = new MockSupabase({
      lead: leadFixture(),
      convState: freshState({
        state: 'CONFIRM_BOOKING',
        data: { nome: 'Ana' },
      }),
    });
    const { calculateLeadScore } = loadScorerWithMock(mock);
    const result = await calculateLeadScore('lead-uuid-001', mock);

    assert.equal(result.score, 95);
    assert.equal(result.label, 'hot');
    assert.ok(result.breakdown.some(b => b.criterion === 'stage:CONFIRM_BOOKING'));
    assert.ok(result.breakdown.some(b => b.criterion === 'data:nome'));
  });

  it('2. SEND_QUOTE state → score 60, label warm (50-74)', async () => {
    const mock = new MockSupabase({
      lead: leadFixture(),
      convState: freshState({ state: 'SEND_QUOTE', data: {} }),
    });
    const { calculateLeadScore } = loadScorerWithMock(mock);
    const result = await calculateLeadScore('lead-uuid-001', mock);

    assert.equal(result.score, 60);
    assert.equal(result.label, 'warm');
  });

  it('3. ASK_GUESTS state → score 30, label nurture (25-49)', async () => {
    const mock = new MockSupabase({
      lead: leadFixture(),
      convState: freshState({ state: 'ASK_GUESTS', data: {} }),
    });
    const { calculateLeadScore } = loadScorerWithMock(mock);
    const result = await calculateLeadScore('lead-uuid-001', mock);

    assert.equal(result.score, 30);
    assert.equal(result.label, 'nurture');
  });

  it('4. GREETING state → score 5, label cold (0-24)', async () => {
    const mock = new MockSupabase({
      lead: leadFixture(),
      convState: freshState({ state: 'GREETING', data: {} }),
    });
    const { calculateLeadScore } = loadScorerWithMock(mock);
    const result = await calculateLeadScore('lead-uuid-001', mock);

    assert.equal(result.score, 5);
    assert.equal(result.label, 'cold');
  });

  it('5. Inactivity > 7 days applies -25 penalty', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const mock = new MockSupabase({
      lead: leadFixture(),
      convState: {
        state: 'SEND_QUOTE',     // +60
        data: {},
        metadata: {},
        updated_at: eightDaysAgo,
      },
    });
    const { calculateLeadScore } = loadScorerWithMock(mock);
    const result = await calculateLeadScore('lead-uuid-001', mock);

    // 60 - 25 = 35
    assert.equal(result.score, 35);
    assert.ok(result.breakdown.some(b => b.criterion === 'penalty:inactive>7days'));
  });

  it('6. Score is capped at 100 (ceiling)', async () => {
    // CONFIRM_BOOKING(90) + nome(5) + data_entrada(10) + data_saida(5) + pessoas(5) + pessoas>=3(8) = 123 → cap 100
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const yyyy = tomorrow.getFullYear();
    const checkInStr = `${dd}/${mm}/${yyyy}`;

    const mock = new MockSupabase({
      lead: leadFixture(),
      convState: freshState({
        state: 'CONFIRM_BOOKING',
        data: {
          nome: 'Carlos',
          data_entrada: checkInStr,
          data_saida: `${dd}/${mm}/${yyyy}`,
          pessoas: 4,
        },
      }),
    });
    const { calculateLeadScore } = loadScorerWithMock(mock);
    const result = await calculateLeadScore('lead-uuid-001', mock);

    assert.equal(result.score, 100);
    assert.equal(result.label, 'hot');
  });

  it('7. Score does not go below 0 (floor)', async () => {
    // GREETING(5) - inactive>7days(-25) - attempts>3(-10) = -30 → floor 0
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const mock = new MockSupabase({
      lead: leadFixture(),
      convState: {
        state: 'GREETING',
        data: {},
        metadata: { attempts_asking_dates: 3, attempts_collect_name: 2 },
        updated_at: tenDaysAgo,
      },
    });
    const { calculateLeadScore } = loadScorerWithMock(mock);
    const result = await calculateLeadScore('lead-uuid-001', mock);

    assert.equal(result.score, 0);
    assert.equal(result.label, 'cold');
  });

  it('8. Breakdown lists applied criteria', async () => {
    const mock = new MockSupabase({
      lead: leadFixture(),
      convState: freshState({
        state: 'ASK_DATES',
        data: { nome: 'Maria' },
      }),
    });
    const { calculateLeadScore } = loadScorerWithMock(mock);
    const result = await calculateLeadScore('lead-uuid-001', mock);

    assert.ok(Array.isArray(result.breakdown));
    assert.ok(result.breakdown.length > 0);

    const criteria = result.breakdown.map(b => b.criterion);
    assert.ok(criteria.includes('stage:ASK_DATES'));
    assert.ok(criteria.includes('data:nome'));

    // Each entry has criterion and points
    for (const entry of result.breakdown) {
      assert.ok(typeof entry.criterion === 'string');
      assert.ok(typeof entry.points === 'number');
    }
  });

});
