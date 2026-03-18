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
   * Generate prescriptive prompt injection for Claude.
   * Tells Luna WHAT TO DO in this message, not just what to avoid.
   * Sistema decide → IA executa.
   *
   * @returns {string} Formatted context block for Claude
   */
  getPromptInjection() {
    if (!this._isLoaded) {
      throw new Error('State not loaded. Call load() first.');
    }

    const data = this._data;

    // Build collected data section
    const collected = [];
    if (data.nome)         collected.push(`• Nome: ${data.nome}`);
    if (data.data_entrada) collected.push(`• Checkin: ${data.data_entrada}`);
    if (data.data_saida)   collected.push(`• Checkout: ${data.data_saida}`);
    if (data.pessoas)      collected.push(`• Hóspedes: ${data.pessoas}`);
    if (data.tipo_quarto)  collected.push(`• Quarto: ${data.tipo_quarto}`);
    if (data.quotedTotal)  collected.push(`• Valor cotado: R$ ${Number(data.quotedTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    const collectedSection = collected.length > 0
      ? `✅ JÁ COLETADO (não pergunte de novo):\n${collected.join('\n')}`
      : '(Nenhum dado coletado ainda)';

    const directive = this._getStateDirective(data);

    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTROLE DO FUNIL — Estado: ${this._state}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${collectedSection}

🎯 OBJETIVO DESTA MENSAGEM:
${directive}

⚠️ Regras: não peça informações já coletadas. Em 3 tentativas sem resposta → [ESCALAR: motivo=Sem resposta].
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  /**
   * Returns a prescriptive directive for each FSM state.
   * Tells Luna exactly what to do in this turn.
   *
   * @private
   * @param {object} data - Collected conversation data
   * @returns {string} One-paragraph directive
   */
  _getStateDirective(data) {
    switch (this._state) {
      case ConversationStateMachine.STATES.GREETING:
        return data.nome
          ? `Dê boas-vindas usando o nome do hóspede. Pergunte as datas de checkin e checkout.`
          : `Dê boas-vindas calorosas e pergunte o nome do hóspede de forma casual. Quando responder, inclua [NOME: NomeCapturado].`;

      case ConversationStateMachine.STATES.COLLECT_NAME:
        return `Pergunte o nome do hóspede de forma natural. Quando obtiver, inclua [NOME: NomeCapturado] na resposta.`;

      case ConversationStateMachine.STATES.ASK_DATES:
        return `Pergunte a data de checkin E checkout em uma única mensagem. Não pergunte número de hóspedes ainda. Aguarde as datas antes de qualquer cotação.`;

      case ConversationStateMachine.STATES.ASK_GUESTS: {
        const periodo = (data.data_entrada && data.data_saida)
          ? ` (${data.data_entrada} → ${data.data_saida})`
          : '';
        return `Datas coletadas${periodo}. Pergunte quantos hóspedes vão se hospedar. Não apresente quartos ainda.`;
      }

      case ConversationStateMachine.STATES.SHOW_ROOMS: {
        const pessoas = parseInt(data.pessoas) || 0;
        let sugestao = '';
        if (pessoas <= 3)      sugestao = 'Sugerir ALA_A (acomoda até 3 pessoas).';
        else if (pessoas <= 5) sugestao = 'Sugerir ALA_B (acomoda até 5 pessoas).';
        else if (pessoas <= 8) sugestao = 'Sugerir ALA_C_CASAL (acomoda até 8 pessoas).';
        else                   sugestao = 'Grupo grande — use [ESCALAR: motivo=Grupo acima de 8 pessoas].';
        return `Apresente as opções de quarto disponíveis. ${sugestao} Pergunte qual o hóspede prefere para gerar a cotação.`;
      }

      case ConversationStateMachine.STATES.SEND_QUOTE: {
        if (data.quotedTotal) {
          const total = Number(data.quotedTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          return `Apresente a cotação já calculada: R$ ${total} para ${data.pessoas} hóspede(s), ${data.data_entrada} → ${data.data_saida}, quarto ${data.tipo_quarto}. NÃO recalcule. Use este valor fixo no [CONFIRMAR:total=...]. Convide o hóspede a confirmar a reserva.`;
        }
        return `Calcule a cotação emitindo o sinal [COTAR:tipo=${data.tipo_quarto || 'TIPO'},data_entrada=${data.data_entrada || 'DD/MM/YYYY'},data_saida=${data.data_saida || 'DD/MM/YYYY'},pessoas=${data.pessoas || 'N'}]. Apresente o valor e convide para confirmar.`;
      }

      case ConversationStateMachine.STATES.CONFIRM_BOOKING: {
        const total = data.quotedTotal
          ? `R$ ${Number(data.quotedTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : 'valor a confirmar';
        return `O hóspede quer reservar. Confirme os detalhes: ${data.data_entrada} → ${data.data_saida}, ${data.pessoas} hóspedes, ${total}. Emita [CONFIRMAR:nome=${data.nome || 'NOME'},entrada=${data.data_entrada || ''},saida=${data.data_saida || ''},tipo=${data.tipo_quarto || ''},pessoas=${data.pessoas || ''},total=${data.quotedTotal || ''}] para notificar a equipe.`;
      }

      case ConversationStateMachine.STATES.HANDOFF_HUMAN:
        return `A equipe já foi notificada. Informe o hóspede que um atendente entrará em contato em breve. Seja cordial e tranquilizador. Não colete mais dados.`;

      default:
        return `Continue a conversa coletando as informações necessárias para a reserva (nome, datas, número de hóspedes).`;
    }
  }

  /**
   * Reset conversation to GREETING, clearing all collected data.
   * Bypasses VALID_TRANSITIONS — works from any state including terminal HANDOFF_HUMAN.
   *
   * @returns {Promise<void>}
   * @throws {Error} If Supabase query fails
   */
  async reset() {
    if (!this._isLoaded) {
      throw new Error('State not loaded. Call load() first.');
    }

    const newExpiresAt = new Date(Date.now() + ConversationStateMachine.TTL_HOURS * 60 * 60 * 1000);

    try {
      const { error } = await this.supabaseClient
        .from('conversation_states')
        .upsert({
          lead_id: this.leadId,
          phone: this.phone,
          state: ConversationStateMachine.STATES.GREETING,
          data: {},
          metadata: {},
          created_at: this._createdAt,
          updated_at: new Date(),
          expires_at: newExpiresAt,
        }, { onConflict: 'lead_id' });

      if (error) {
        throw new Error(`Reset failed: ${error.message}`);
      }

      this._state = ConversationStateMachine.STATES.GREETING;
      this._data = {};
      this._metadata = {};
      this._updatedAt = new Date();
      this._expiresAt = newExpiresAt;
    } catch (err) {
      console.error('[state-machine] Reset error:', err.message);
      throw err;
    }
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
