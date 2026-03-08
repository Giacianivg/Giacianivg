'use strict';

/**
 * ConversationStateMachine
 *
 * Manages persistent conversation state for guest reservations.
 * 8-state deterministic funnel: GREETING → COLLECT_NAME → ASK_DATES → ... → HANDOFF_HUMAN
 *
 * @class ConversationStateMachine
 * @requires supabase-js
 */

class ConversationStateMachine {
  // ─────────────────────────────────────────────────────────────────
  // Constants
  // ─────────────────────────────────────────────────────────────────

  static STATES = {
    GREETING: 'GREETING',
    COLLECT_NAME: 'COLLECT_NAME',
    ASK_DATES: 'ASK_DATES',
    ASK_GUESTS: 'ASK_GUESTS',
    SHOW_ROOMS: 'SHOW_ROOMS',
    SEND_QUOTE: 'SEND_QUOTE',
    CONFIRM_BOOKING: 'CONFIRM_BOOKING',
    HANDOFF_HUMAN: 'HANDOFF_HUMAN',
  };

  static VALID_TRANSITIONS = {
    GREETING: ['COLLECT_NAME'],
    COLLECT_NAME: ['ASK_DATES', 'HANDOFF_HUMAN'],
    ASK_DATES: ['ASK_GUESTS', 'HANDOFF_HUMAN'],
    ASK_GUESTS: ['SHOW_ROOMS', 'ASK_DATES', 'HANDOFF_HUMAN'],
    SHOW_ROOMS: ['SEND_QUOTE', 'ASK_GUESTS', 'HANDOFF_HUMAN'],
    SEND_QUOTE: ['CONFIRM_BOOKING', 'ASK_GUESTS', 'HANDOFF_HUMAN'],
    CONFIRM_BOOKING: ['HANDOFF_HUMAN'],
    HANDOFF_HUMAN: [], // Terminal state
  };

  static TTL_HOURS = 24;
  static HANDOFF_TTL_HOURS = 48;
  static MAX_ATTEMPTS_BEFORE_ESCALATION = 3;

  // ─────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────

  /**
   * @param {string} leadId - UUID of the guest (lead)
   * @param {string} phone - Phone number (e.g., '5519987654321' or '19987654321')
   * @param {object} supabaseClient - Initialized Supabase client
   */
  constructor(leadId, phone, supabaseClient) {
    this.leadId = leadId;
    this.phone = phone;
    this.supabaseClient = supabaseClient;

    // Internal state (loaded from DB or initialized)
    this._state = null;
    this._data = {};
    this._metadata = {};
    this._createdAt = null;
    this._updatedAt = null;
    this._expiresAt = null;
    this._isLoaded = false;
  }

  // ─────────────────────────────────────────────────────────────────
  // Public Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Load conversation state from Supabase.
   * If not found, initialize as GREETING.
   *
   * @returns {Promise<void>}
   * @throws {Error} If Supabase query fails
   */
  async load() {
    try {
      const { data, error } = await this.supabaseClient
        .from('conversation_states')
        .select('*')
        .eq('lead_id', this.leadId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found (expected for new guests)
        throw new Error(`Failed to load conversation state: ${error.message}`);
      }

      if (data) {
        // State exists, load it
        this._state = data.state;
        this._data = data.data || {};
        this._metadata = data.metadata || {};
        this._createdAt = new Date(data.created_at);
        this._updatedAt = new Date(data.updated_at);
        this._expiresAt = new Date(data.expires_at);
      } else {
        // New guest, initialize
        this._state = ConversationStateMachine.STATES.GREETING;
        this._data = {};
        this._metadata = {};
        this._createdAt = new Date();
        this._updatedAt = new Date();
        this._expiresAt = new Date(Date.now() + ConversationStateMachine.TTL_HOURS * 60 * 60 * 1000);
      }

      this._isLoaded = true;
    } catch (err) {
      console.error('[state-machine] Load error:', err.message);
      throw err;
    }
  }

  /**
   * Transition to a new state (with validation).
   *
   * @param {string} nextState - Target state
   * @returns {Promise<void>}
   * @throws {Error} If transition is invalid
   */
  async transition(nextState) {
    if (!this._isLoaded) {
      throw new Error('State not loaded. Call load() first.');
    }

    // Validate transition
    const validTransitions = ConversationStateMachine.VALID_TRANSITIONS[this._state];
    if (!validTransitions.includes(nextState)) {
      throw new Error(
        `Invalid transition: ${this._state} → ${nextState}. ` +
        `Valid transitions: ${validTransitions.join(', ')}`
      );
    }

    // Update expires_at for HANDOFF_HUMAN (48h window for team)
    const newExpiresAt = nextState === ConversationStateMachine.STATES.HANDOFF_HUMAN
      ? new Date(Date.now() + ConversationStateMachine.HANDOFF_TTL_HOURS * 60 * 60 * 1000)
      : new Date(Date.now() + ConversationStateMachine.TTL_HOURS * 60 * 60 * 1000);

    try {
      const { error } = await this.supabaseClient
        .from('conversation_states')
        .upsert({
          lead_id: this.leadId,
          phone: this.phone,
          state: nextState,
          data: this._data,
          metadata: this._metadata,
          created_at: this._createdAt,
          updated_at: new Date(),
          expires_at: newExpiresAt,
        }, { onConflict: 'lead_id' });

      if (error) {
        throw new Error(`Transition failed: ${error.message}`);
      }

      // Update local state
      this._state = nextState;
      this._updatedAt = new Date();
      this._expiresAt = newExpiresAt;
    } catch (err) {
      console.error('[state-machine] Transition error:', err.message);
      throw err;
    }
  }

  /**
   * Update collected context data (progressive filling).
   * Merges with existing data.
   *
   * @param {object} changes - Fields to update (e.g., { nome: 'João', pessoas: 2 })
   * @returns {Promise<void>}
   */
  async updateContext(changes) {
    if (!this._isLoaded) {
      throw new Error('State not loaded. Call load() first.');
    }

    // Merge changes into existing data
    this._data = { ...this._data, ...changes };

    try {
      const { error } = await this.supabaseClient
        .from('conversation_states')
        .update({
          data: this._data,
          updated_at: new Date(),
        })
        .eq('lead_id', this.leadId);

      if (error) {
        throw new Error(`Update context failed: ${error.message}`);
      }

      this._updatedAt = new Date();
    } catch (err) {
      console.error('[state-machine] Update context error:', err.message);
      throw err;
    }
  }

  /**
   * Increment attempt counter in metadata.
   * Auto-escalates if > MAX_ATTEMPTS.
   *
   * @param {string} field - Metadata field (e.g., 'attempts_asking_dates')
   * @returns {Promise<boolean>} true if escalation triggered
   */
  async trackAttempt(field) {
    if (!this._isLoaded) {
      throw new Error('State not loaded. Call load() first.');
    }

    this._metadata[field] = (this._metadata[field] || 0) + 1;

    // Check if exceeded max attempts (>= 3 means on the 3rd attempt)
    const escalate = this._metadata[field] >= ConversationStateMachine.MAX_ATTEMPTS_BEFORE_ESCALATION;

    try {
      await this.supabaseClient
        .from('conversation_states')
        .update({
          metadata: this._metadata,
          updated_at: new Date(),
        })
        .eq('lead_id', this.leadId);

      this._updatedAt = new Date();
    } catch (err) {
      console.error('[state-machine] Track attempt error:', err.message);
      throw err;
    }

    return escalate;
  }

  /**
   * Generate prompt injection for Claude.
   * Injects state context into system prompt to prevent repetition.
   *
   * @returns {string} Formatted context block for Claude
   */
  getPromptInjection() {
    if (!this._isLoaded) {
      throw new Error('State not loaded. Call load() first.');
    }

    const stateNumber = Object.values(ConversationStateMachine.STATES).indexOf(this._state) + 1;
    const totalStates = Object.keys(ConversationStateMachine.STATES).length;

    let collectedItems = [];
    if (this._data.nome) collectedItems.push(`• Nome: ${this._data.nome}`);
    if (this._data.data_entrada) collectedItems.push(`• Data entrada: ${this._data.data_entrada}`);
    if (this._data.data_saida) collectedItems.push(`• Data saída: ${this._data.data_saida}`);
    if (this._data.pessoas) collectedItems.push(`• Hóspedes: ${this._data.pessoas}`);
    if (this._data.tipo_quarto) collectedItems.push(`• Tipo quarto: ${this._data.tipo_quarto}`);

    const collectedSection = collectedItems.length > 0
      ? `✅ Já coletado:\n${collectedItems.join('\n')}`
      : '(Nenhum dado coletado ainda)';

    const noRepeatFields = collectedItems.map(item => item.split(':')[0].trim()).join(', ');

    // Add state-specific instructions for COLLECT_NAME
    const stateSpecificInstructions = this._state === 'COLLECT_NAME'
      ? '\n📝 ETAPA ATUAL: Coletar nome do hóspede\n✅ Se receber nome → [NOME: NomeCapturado]\n⚠️ Se usuário não responder nome → após 2 tentativas, passe para próxima etapa'
      : '';

    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONVERSATION STATE CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Estado atual: ${this._state}
Etapa do funil: ${stateNumber}/${totalStates}

${collectedSection}
${stateSpecificInstructions}

❌ NÃO REPITA perguntas sobre: ${noRepeatFields || '(nenhum dado coletado)'}
✅ Mantenha fluxo linear através dos 8 estados (GREETING → COLLECT_NAME → ASK_DATES → ...)
✅ Se usuário insistir em voltar, explique a progressão natural
⚠️ Em 3 tentativas sem resposta → [ESCALAR: motivo=Não respondeu]
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`;
  }

  /**
   * Set escalation reason in metadata.
   *
   * @param {string} reason - Escalation reason
   * @returns {Promise<void>}
   */
  async setEscalationReason(reason) {
    if (!this._isLoaded) {
      throw new Error('State not loaded. Call load() first.');
    }

    this._metadata.escalation_reason = reason;

    try {
      await this.supabaseClient
        .from('conversation_states')
        .update({
          metadata: this._metadata,
          updated_at: new Date(),
        })
        .eq('lead_id', this.leadId);

      this._updatedAt = new Date();
    } catch (err) {
      console.error('[state-machine] Set escalation reason error:', err.message);
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Getters
  // ─────────────────────────────────────────────────────────────────

  get currentState() {
    return this._state;
  }

  get collectedData() {
    return { ...this._data };
  }

  get metadata() {
    return { ...this._metadata };
  }

  get isExpired() {
    return this._expiresAt && new Date() > this._expiresAt;
  }

  get isTerminal() {
    return this._state === ConversationStateMachine.STATES.HANDOFF_HUMAN;
  }

  get isLoaded() {
    return this._isLoaded;
  }

  // ─────────────────────────────────────────────────────────────────
  // Static Utility Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Check if a state transition is valid.
   *
   * @static
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @returns {boolean} true if transition is allowed
   */
  static isValidTransition(fromState, toState) {
    const validTransitions = ConversationStateMachine.VALID_TRANSITIONS[fromState];
    return validTransitions ? validTransitions.includes(toState) : false;
  }

  /**
   * Get list of valid next states from current state.
   *
   * @static
   * @param {string} currentState - Current state
   * @returns {string[]} Array of valid next states
   */
  static getValidNextStates(currentState) {
    return ConversationStateMachine.VALID_TRANSITIONS[currentState] || [];
  }
}

module.exports = ConversationStateMachine;
