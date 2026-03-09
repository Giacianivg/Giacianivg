'use strict';

/**
 * Unit tests for Funnel Analytics — Feature 3: Funil Visual
 * Run with: node --test tests/analytics/funnel-analytics.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock Supabase client that returns a fixed array of
 * conversation_states rows when queried from the 'conversation_states' table.
 */
function makeMockSupabase(rows) {
  return {
    from(table) {
      if (table === 'conversation_states') {
        return {
          select() { return this; },
          gte() {
            return Promise.resolve({ data: rows, error: null });
          },
        };
      }
      return {
        select() { return this; },
        gte() { return Promise.resolve({ data: [], error: null }); },
      };
    },
  };
}

/**
 * Loads funnel-analytics with the module cache bypass so we can inject a mock
 * Supabase client without real DB credentials.
 */
const path = require('path');

function loadAnalyticsWithMock(mockClient) {
  const fakeClientPath = path.resolve(__dirname, '../../services/supabase/client.js');

  require.cache[fakeClientPath] = {
    id: fakeClientPath,
    filename: fakeClientPath,
    loaded: true,
    exports: { supabaseAdmin: mockClient },
  };

  const analyticsPath = path.resolve(__dirname, '../../services/analytics/funnel-analytics.js');
  delete require.cache[analyticsPath];

  return require(analyticsPath);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = Date.now();
const H = 3600000; // 1 hour in ms

/** A state record updated 30h ago — qualifies as stalled (> 24h) */
function stalledState(state, leadId, phone) {
  return {
    lead_id: leadId,
    phone,
    state,
    data: {},
    created_at: new Date(NOW - 48 * H).toISOString(), // created 48h ago
    updated_at: new Date(NOW - 30 * H).toISOString(), // updated 30h ago (stalled)
    expires_at: new Date(NOW + 24 * H).toISOString(),
  };
}

/** A state record updated 1h ago — active (< 24h) */
function activeState(state, leadId, phone) {
  return {
    lead_id: leadId,
    phone,
    state,
    data: {},
    created_at: new Date(NOW - 2 * H).toISOString(),  // created 2h ago
    updated_at: new Date(NOW - 1 * H).toISOString(),  // updated 1h ago (active)
    expires_at: new Date(NOW + 24 * H).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getFunnelData', () => {

  it('1. Groups correctly by state — 8 FSM states present in output', async () => {
    const mockStates = [
      activeState('GREETING', 'lead-1', '5519999999991'),
      activeState('COLLECT_NAME', 'lead-2', '5519999999992'),
      activeState('ASK_DATES', 'lead-3', '5519999999993'),
      activeState('ASK_GUESTS', 'lead-4', '5519999999994'),
      activeState('SHOW_ROOMS', 'lead-5', '5519999999995'),
      stalledState('SEND_QUOTE', 'lead-6', '5519999999996'),
      activeState('CONFIRM_BOOKING', 'lead-7', '5519999999997'),
      activeState('HANDOFF_HUMAN', 'lead-8', '5519999999998'),
    ];

    const mock = makeMockSupabase(mockStates);
    const { getFunnelData } = loadAnalyticsWithMock(mock);
    const result = await getFunnelData(30, mock);

    // All 8 FSM states should appear in stages
    const stageNames = result.stages.map((s) => s.name);
    assert.ok(stageNames.includes('GREETING'), 'missing GREETING');
    assert.ok(stageNames.includes('COLLECT_NAME'), 'missing COLLECT_NAME');
    assert.ok(stageNames.includes('ASK_DATES'), 'missing ASK_DATES');
    assert.ok(stageNames.includes('ASK_GUESTS'), 'missing ASK_GUESTS');
    assert.ok(stageNames.includes('SHOW_ROOMS'), 'missing SHOW_ROOMS');
    assert.ok(stageNames.includes('SEND_QUOTE'), 'missing SEND_QUOTE');
    assert.ok(stageNames.includes('CONFIRM_BOOKING'), 'missing CONFIRM_BOOKING');
    assert.ok(stageNames.includes('HANDOFF_HUMAN'), 'missing HANDOFF_HUMAN');

    // Each state should have exactly 1 lead
    for (const stage of result.stages) {
      if (mockStates.some((s) => s.state === stage.name)) {
        assert.equal(stage.count, 1, `stage ${stage.name} should have count 1`);
      }
    }
  });

  it('2. Calculates stalled_count correctly — only leads with updated_at > 24h ago', async () => {
    const mockStates = [
      stalledState('SEND_QUOTE', 'lead-1', '5519999999991'), // stalled (30h ago)
      stalledState('SEND_QUOTE', 'lead-2', '5519999999992'), // stalled (30h ago)
      activeState('SEND_QUOTE', 'lead-3', '5519999999993'),  // active (1h ago)
    ];

    const mock = makeMockSupabase(mockStates);
    const { getFunnelData } = loadAnalyticsWithMock(mock);
    const result = await getFunnelData(30, mock);

    const sendQuoteStage = result.stages.find((s) => s.name === 'SEND_QUOTE');
    assert.ok(sendQuoteStage, 'SEND_QUOTE stage not found');
    assert.equal(sendQuoteStage.count, 3, 'total count should be 3');
    assert.equal(sendQuoteStage.stalled_count, 2, 'stalled_count should be 2');
  });

  it('3. Identifies bottleneck_stage as the state with the highest stalled_count', async () => {
    const mockStates = [
      // SEND_QUOTE has 3 stalled
      stalledState('SEND_QUOTE', 'lead-1', '5519999999991'),
      stalledState('SEND_QUOTE', 'lead-2', '5519999999992'),
      stalledState('SEND_QUOTE', 'lead-3', '5519999999993'),
      // ASK_DATES has 1 stalled
      stalledState('ASK_DATES', 'lead-4', '5519999999994'),
      // GREETING has 2 stalled
      stalledState('GREETING', 'lead-5', '5519999999995'),
      stalledState('GREETING', 'lead-6', '5519999999996'),
    ];

    const mock = makeMockSupabase(mockStates);
    const { getFunnelData } = loadAnalyticsWithMock(mock);
    const result = await getFunnelData(30, mock);

    assert.equal(result.bottleneck_stage, 'SEND_QUOTE', 'bottleneck should be SEND_QUOTE (3 stalled)');
  });

  it('4. conversion_rate is 0 when there are no leads in CONFIRM_BOOKING', async () => {
    const mockStates = [
      activeState('GREETING', 'lead-1', '5519999999991'),
      activeState('GREETING', 'lead-2', '5519999999992'),
      activeState('ASK_DATES', 'lead-3', '5519999999993'),
    ];

    const mock = makeMockSupabase(mockStates);
    const { getFunnelData } = loadAnalyticsWithMock(mock);
    const result = await getFunnelData(30, mock);

    assert.equal(result.conversion_rate, 0, 'conversion_rate should be 0');
  });

  it('5. drop_off_rate is calculated correctly as stalled_count / count', async () => {
    const mockStates = [
      stalledState('SHOW_ROOMS', 'lead-1', '5519999999991'), // stalled
      activeState('SHOW_ROOMS', 'lead-2', '5519999999992'),  // active
      activeState('SHOW_ROOMS', 'lead-3', '5519999999993'),  // active
      activeState('SHOW_ROOMS', 'lead-4', '5519999999994'),  // active
    ];

    const mock = makeMockSupabase(mockStates);
    const { getFunnelData } = loadAnalyticsWithMock(mock);
    const result = await getFunnelData(30, mock);

    const showRoomsStage = result.stages.find((s) => s.name === 'SHOW_ROOMS');
    assert.ok(showRoomsStage, 'SHOW_ROOMS stage not found');
    assert.equal(showRoomsStage.count, 4);
    assert.equal(showRoomsStage.stalled_count, 1);

    // drop_off_rate = 1 / 4 = 0.25
    assert.equal(showRoomsStage.drop_off_rate, 0.25, 'drop_off_rate should be 0.25');
  });

  it('6. Handles empty list gracefully — no errors, zero totals', async () => {
    const mock = makeMockSupabase([]);
    const { getFunnelData } = loadAnalyticsWithMock(mock);

    let result;
    await assert.doesNotReject(async () => {
      result = await getFunnelData(30, mock);
    });

    assert.equal(result.total_active_leads, 0);
    assert.equal(result.conversion_rate, 0);
    assert.equal(result.avg_funnel_time_hours, 0);

    // All 8 FSM stages should still be present with count 0
    assert.equal(result.stages.length, 8, 'should have 8 FSM stages even when empty');
    for (const stage of result.stages) {
      assert.equal(stage.count, 0, `${stage.name} count should be 0`);
      assert.equal(stage.stalled_count, 0, `${stage.name} stalled_count should be 0`);
      assert.equal(stage.drop_off_rate, 0, `${stage.name} drop_off_rate should be 0`);
    }
  });

});
