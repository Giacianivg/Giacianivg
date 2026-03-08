'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const ConversationStateMachine = require('../services/state-machine/index');

// Mock Supabase client
class MockSupabaseClient {
  constructor() {
    this.data = new Map(); // Simulates DB: leadId → { lead_id, phone, state, data, metadata, ... }
  }

  from(table) {
    if (table !== 'conversation_states') {
      throw new Error(`Unexpected table: ${table}`);
    }
    return this;
  }

  select(cols) {
    return this;
  }

  eq(field, value) {
    this._selectField = field;
    this._selectValue = value;
    return this;
  }

  async single() {
    // Simulate SELECT * WHERE field = value
    const record = this.data.get(this._selectValue);
    if (!record) {
      return { data: null, error: { code: 'PGRST116' } }; // No rows found
    }
    return { data: record, error: null };
  }

  update(fields) {
    this._updateFields = fields;
    return this;
  }

  async upsert(record, options) {
    // Simulate UPSERT
    this.data.set(record.lead_id, {
      ...this.data.get(record.lead_id),
      ...record,
      updated_at: new Date(),
    });
    return { data: null, error: null };
  }

  _mockInsert(leadId, record) {
    this.data.set(leadId, record);
  }
}

describe('ConversationStateMachine', () => {
  let mockDb;
  let fsm;
  const testLeadId = '12345678-1234-1234-1234-123456789abc';
  const testPhone = '5519987654321';

  beforeEach(() => {
    mockDb = new MockSupabaseClient();
    fsm = new ConversationStateMachine(testLeadId, testPhone, mockDb);
  });

  // ─────────────────────────────────────────────────────────────────
  // Unit Tests: Basic Functionality
  // ─────────────────────────────────────────────────────────────────

  describe('load()', () => {
    it('should initialize new state as GREETING', async () => {
      await fsm.load();
      assert.strictEqual(fsm.currentState, 'GREETING');
      assert.deepStrictEqual(fsm.collectedData, {});
      assert.strictEqual(fsm.isLoaded, true);
    });

    it('should load existing state from database', async () => {
      // Pre-populate DB with existing state
      mockDb._mockInsert(testLeadId, {
        lead_id: testLeadId,
        phone: testPhone,
        state: 'ASK_DATES',
        data: { nome: 'João Silva' },
        metadata: { attempts_asking_dates: 1 },
        created_at: new Date(),
        updated_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await fsm.load();
      assert.strictEqual(fsm.currentState, 'ASK_DATES');
      assert.strictEqual(fsm.collectedData.nome, 'João Silva');
      assert.strictEqual(fsm.metadata.attempts_asking_dates, 1);
    });
  });

  describe('transition()', () => {
    beforeEach(async () => {
      await fsm.load();
    });

    it('should allow valid transition GREETING → ASK_DATES', async () => {
      await fsm.transition('ASK_DATES');
      assert.strictEqual(fsm.currentState, 'ASK_DATES');
    });

    it('should block invalid transition GREETING → SEND_QUOTE', async () => {
      assert.rejects(
        () => fsm.transition('SEND_QUOTE'),
        /Invalid transition/
      );
    });

    it('should allow ASK_DATES → ASK_GUESTS', async () => {
      await fsm.transition('ASK_DATES');
      await fsm.transition('ASK_GUESTS');
      assert.strictEqual(fsm.currentState, 'ASK_GUESTS');
    });

    it('should allow ASK_DATES → HANDOFF_HUMAN (escalation)', async () => {
      await fsm.transition('ASK_DATES');
      await fsm.transition('HANDOFF_HUMAN');
      assert.strictEqual(fsm.currentState, 'HANDOFF_HUMAN');
    });

    it('should be terminal state (HANDOFF_HUMAN → no transitions allowed)', async () => {
      await fsm.transition('ASK_DATES');
      await fsm.transition('HANDOFF_HUMAN');
      assert.strictEqual(
        ConversationStateMachine.isValidTransition('HANDOFF_HUMAN', 'ASK_GUESTS'),
        false
      );
    });
  });

  describe('updateContext()', () => {
    beforeEach(async () => {
      await fsm.load();
    });

    it('should merge data into collected context', async () => {
      await fsm.updateContext({ nome: 'João Silva' });
      assert.strictEqual(fsm.collectedData.nome, 'João Silva');
    });

    it('should merge multiple fields progressively', async () => {
      await fsm.updateContext({ nome: 'João Silva' });
      await fsm.updateContext({ data_entrada: '15/03/2026' });
      assert.strictEqual(fsm.collectedData.nome, 'João Silva');
      assert.strictEqual(fsm.collectedData.data_entrada, '15/03/2026');
    });

    it('should overwrite existing field', async () => {
      await fsm.updateContext({ pessoas: 2 });
      await fsm.updateContext({ pessoas: 3 });
      assert.strictEqual(fsm.collectedData.pessoas, 3);
    });
  });

  describe('getPromptInjection()', () => {
    beforeEach(async () => {
      await fsm.load();
    });

    it('should contain current state', async () => {
      const injection = fsm.getPromptInjection();
      assert.match(injection, /Estado atual: GREETING/);
    });

    it('should contain collected data if exists', async () => {
      await fsm.updateContext({ nome: 'João Silva', data_entrada: '15/03' });
      const injection = fsm.getPromptInjection();
      assert.match(injection, /João Silva/);
      assert.match(injection, /15\/03/);
    });

    it('should not repeat questions about collected fields', async () => {
      await fsm.updateContext({ nome: 'João Silva' });
      const injection = fsm.getPromptInjection();
      assert.match(injection, /NÃO REPITA perguntas sobre/);
      assert.match(injection, /Nome/);
    });

    it('should show current funnel step (X/7)', async () => {
      const injection = fsm.getPromptInjection();
      assert.match(injection, /Etapa do funil: 1\/7/);

      await fsm.transition('ASK_DATES');
      const injectionAfter = fsm.getPromptInjection();
      assert.match(injectionAfter, /Etapa do funil: 2\/7/);
    });
  });

  describe('trackAttempt()', () => {
    beforeEach(async () => {
      await fsm.load();
    });

    it('should increment attempt counter', async () => {
      const escalate1 = await fsm.trackAttempt('attempts_asking_dates');
      assert.strictEqual(escalate1, false); // 1 < 3

      const escalate2 = await fsm.trackAttempt('attempts_asking_dates');
      assert.strictEqual(escalate2, false); // 2 < 3

      const escalate3 = await fsm.trackAttempt('attempts_asking_dates');
      assert.strictEqual(escalate3, true); // 3 === MAX (auto-escalate)
    });

    it('should auto-escalate after MAX_ATTEMPTS', async () => {
      const escalate = await fsm.trackAttempt('attempts_asking_dates');
      assert.strictEqual(escalate, false);
      const escalate2 = await fsm.trackAttempt('attempts_asking_dates');
      assert.strictEqual(escalate2, false);
      const escalate3 = await fsm.trackAttempt('attempts_asking_dates');
      assert.strictEqual(escalate3, true);
    });
  });

  describe('setEscalationReason()', () => {
    beforeEach(async () => {
      await fsm.load();
    });

    it('should set escalation reason in metadata', async () => {
      const reason = 'Não respondeu após 3 tentativas';
      await fsm.setEscalationReason(reason);
      assert.strictEqual(fsm.metadata.escalation_reason, reason);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Unit Tests: Static Utilities
  // ─────────────────────────────────────────────────────────────────

  describe('isValidTransition()', () => {
    it('should validate GREETING → ASK_DATES', () => {
      assert.strictEqual(ConversationStateMachine.isValidTransition('GREETING', 'ASK_DATES'), true);
    });

    it('should reject GREETING → SEND_QUOTE', () => {
      assert.strictEqual(ConversationStateMachine.isValidTransition('GREETING', 'SEND_QUOTE'), false);
    });

    it('should validate full happy path', () => {
      assert.strictEqual(ConversationStateMachine.isValidTransition('GREETING', 'ASK_DATES'), true);
      assert.strictEqual(ConversationStateMachine.isValidTransition('ASK_DATES', 'ASK_GUESTS'), true);
      assert.strictEqual(ConversationStateMachine.isValidTransition('ASK_GUESTS', 'SHOW_ROOMS'), true);
      assert.strictEqual(ConversationStateMachine.isValidTransition('SHOW_ROOMS', 'SEND_QUOTE'), true);
      assert.strictEqual(ConversationStateMachine.isValidTransition('SEND_QUOTE', 'CONFIRM_BOOKING'), true);
      assert.strictEqual(ConversationStateMachine.isValidTransition('CONFIRM_BOOKING', 'HANDOFF_HUMAN'), true);
    });
  });

  describe('getValidNextStates()', () => {
    it('should return valid next states for GREETING', () => {
      const valid = ConversationStateMachine.getValidNextStates('GREETING');
      assert.deepStrictEqual(valid, ['ASK_DATES']);
    });

    it('should return multiple valid states for ASK_DATES', () => {
      const valid = ConversationStateMachine.getValidNextStates('ASK_DATES');
      assert.deepStrictEqual(valid, ['ASK_GUESTS', 'HANDOFF_HUMAN']);
    });

    it('should return empty array for terminal state', () => {
      const valid = ConversationStateMachine.getValidNextStates('HANDOFF_HUMAN');
      assert.deepStrictEqual(valid, []);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Integration Tests: Full Flow
  // ─────────────────────────────────────────────────────────────────

  describe('Integration: Happy Path (Full Reservation Flow)', () => {
    it('should complete full 7-state flow: GREETING → HANDOFF_HUMAN', async () => {
      // 1. Load (new guest) → GREETING
      await fsm.load();
      assert.strictEqual(fsm.currentState, 'GREETING');

      // 2. Collect name
      await fsm.updateContext({ nome: 'João Silva' });
      await fsm.transition('ASK_DATES');
      assert.strictEqual(fsm.currentState, 'ASK_DATES');

      // 3. Collect dates
      await fsm.updateContext({ data_entrada: '15/03/2026', data_saida: '17/03/2026' });
      await fsm.transition('ASK_GUESTS');
      assert.strictEqual(fsm.currentState, 'ASK_GUESTS');

      // 4. Collect guests
      await fsm.updateContext({ pessoas: 2 });
      await fsm.transition('SHOW_ROOMS');
      assert.strictEqual(fsm.currentState, 'SHOW_ROOMS');

      // 5. Collect room type
      await fsm.updateContext({ tipo_quarto: 'ALA_A' });
      await fsm.transition('SEND_QUOTE');
      assert.strictEqual(fsm.currentState, 'SEND_QUOTE');

      // 6. Final confirmation
      await fsm.updateContext({
        quote: { total: 600, currency: 'BRL', breakdown: {} },
      });
      await fsm.transition('CONFIRM_BOOKING');
      assert.strictEqual(fsm.currentState, 'CONFIRM_BOOKING');

      // 7. Handoff to human
      await fsm.transition('HANDOFF_HUMAN');
      assert.strictEqual(fsm.currentState, 'HANDOFF_HUMAN');

      // Verify final context
      const data = fsm.collectedData;
      assert.strictEqual(data.nome, 'João Silva');
      assert.strictEqual(data.data_entrada, '15/03/2026');
      assert.strictEqual(data.data_saida, '17/03/2026');
      assert.strictEqual(data.pessoas, 2);
      assert.strictEqual(data.tipo_quarto, 'ALA_A');
      assert.strictEqual(data.quote.total, 600);
    });

    it('should allow backtracking ASK_GUESTS → ASK_DATES', async () => {
      await fsm.load();
      await fsm.transition('ASK_DATES');
      await fsm.transition('ASK_GUESTS');

      // Go back to correct dates
      await fsm.transition('ASK_DATES');
      assert.strictEqual(fsm.currentState, 'ASK_DATES');
    });
  });

  describe('Integration: Escalation Path', () => {
    it('should escalate after 3 failed attempts', async () => {
      await fsm.load();
      await fsm.transition('ASK_DATES');

      // Simulate 3 failed attempts
      const esc1 = await fsm.trackAttempt('attempts_asking_dates');
      const esc2 = await fsm.trackAttempt('attempts_asking_dates');
      const esc3 = await fsm.trackAttempt('attempts_asking_dates');

      assert.strictEqual(esc1, false);
      assert.strictEqual(esc2, false);
      assert.strictEqual(esc3, true); // Escalate!

      // Transition to human
      await fsm.setEscalationReason('Não respondeu após 3 tentativas');
      await fsm.transition('HANDOFF_HUMAN');

      assert.strictEqual(fsm.currentState, 'HANDOFF_HUMAN');
      assert.match(fsm.metadata.escalation_reason, /3 tentativas/);
    });

    it('should allow escalation from any state', async () => {
      await fsm.load();
      await fsm.transition('ASK_DATES');
      await fsm.transition('ASK_GUESTS'); // Middle of flow

      // Can escalate anytime
      await fsm.transition('HANDOFF_HUMAN');
      assert.strictEqual(fsm.currentState, 'HANDOFF_HUMAN');
    });
  });

  describe('Integration: Prompt Injection Quality', () => {
    it('should generate proper prompt injection at each stage', async () => {
      await fsm.load();
      await fsm.updateContext({ nome: 'João Silva' });

      // At GREETING
      let inj = fsm.getPromptInjection();
      assert.match(inj, /CONVERSATION STATE CONTEXT/);
      assert.match(inj, /Estado atual: GREETING/);
      assert.match(inj, /João Silva/);

      // At ASK_DATES
      await fsm.transition('ASK_DATES');
      inj = fsm.getPromptInjection();
      assert.match(inj, /Estado atual: ASK_DATES/);
      assert.match(inj, /Etapa do funil: 2\/7/);
      assert.match(inj, /NÃO REPITA perguntas sobre/);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should throw if transition() called before load()', async () => {
      assert.rejects(
        () => fsm.transition('ASK_DATES'),
        /State not loaded/
      );
    });

    it('should throw if updateContext() called before load()', async () => {
      assert.rejects(
        () => fsm.updateContext({ nome: 'Test' }),
        /State not loaded/
      );
    });

    it('should handle empty data gracefully', async () => {
      await fsm.load();
      const inj = fsm.getPromptInjection();
      assert.match(inj, /CONVERSATION STATE CONTEXT/);
      assert.match(inj, /(Nenhum dado coletado|empty)/i);
    });

    it('should NOT be expired immediately after load', async () => {
      await fsm.load();
      assert.strictEqual(fsm.isExpired, false);
    });

    it('should mark terminal state correctly', async () => {
      await fsm.load();
      assert.strictEqual(fsm.isTerminal, false);

      await fsm.transition('ASK_DATES');
      await fsm.transition('ASK_GUESTS');
      await fsm.transition('SHOW_ROOMS');
      await fsm.transition('SEND_QUOTE');
      await fsm.transition('CONFIRM_BOOKING');
      assert.strictEqual(fsm.isTerminal, false);

      await fsm.transition('HANDOFF_HUMAN');
      assert.strictEqual(fsm.isTerminal, true);
    });
  });
});

describe('State Machine: All 7 States Validation', () => {
  it('should define exactly 7 states', () => {
    const states = Object.keys(ConversationStateMachine.STATES);
    assert.strictEqual(states.length, 7);
    assert.deepStrictEqual(states, [
      'GREETING',
      'ASK_DATES',
      'ASK_GUESTS',
      'SHOW_ROOMS',
      'SEND_QUOTE',
      'CONFIRM_BOOKING',
      'HANDOFF_HUMAN',
    ]);
  });

  it('should have valid transitions defined for all states', () => {
    const allStates = Object.values(ConversationStateMachine.STATES);
    const transitionStates = Object.keys(ConversationStateMachine.VALID_TRANSITIONS);

    // All states should have a transition entry
    allStates.forEach(state => {
      assert.ok(
        transitionStates.includes(state),
        `State ${state} missing from VALID_TRANSITIONS`
      );
    });
  });

  it('should only reference valid states in transitions', () => {
    const validStateValues = Object.values(ConversationStateMachine.STATES);
    const transitions = ConversationStateMachine.VALID_TRANSITIONS;

    Object.entries(transitions).forEach(([fromState, toStates]) => {
      toStates.forEach(toState => {
        assert.ok(
          validStateValues.includes(toState),
          `Invalid target state: ${toState} (from ${fromState})`
        );
      });
    });
  });
});
