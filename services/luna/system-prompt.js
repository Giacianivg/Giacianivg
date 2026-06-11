'use strict';

/**
 * System prompt base da Luna — Pousada Luz da Lua
 *
 * ESCOPO RESTRITO: Apenas identidade básica + sinais técnicos obrigatórios.
 * Tom, personalidade, scripts, roteiros de vendas e informações da pousada
 * são configurados via luna-training.html (CRM → luna_config).
 *
 * Desde Fase 1/Etapa B o texto é gerado por buildSystemPrompt() em
 * ./prompt-builder.js, parametrizado (bot, pousada, cidade, tipos de quarto).
 * O export continua sendo a string pronta com os defaults da Luz da Lua —
 * byte-idêntica à versão anterior. Uso multi-tenant: chamar o builder direto.
 *
 * Fonte canônica: services/luna/system-prompt.js
 */

const { buildSystemPrompt } = require('./prompt-builder');

const LUNA_SYSTEM_PROMPT = buildSystemPrompt();

module.exports = LUNA_SYSTEM_PROMPT;
