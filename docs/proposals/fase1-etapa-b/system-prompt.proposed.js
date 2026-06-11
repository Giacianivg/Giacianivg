'use strict';

/**
 * PROPOSTA Fase 1 / Etapa B — NÃO APLICADO
 * Substitui services/luna/system-prompt.js após aprovação CTO.
 *
 * System prompt base da Luna — agora gerado por buildSystemPrompt() em
 * services/luna/prompt-builder.js (arquivo novo), parametrizado por
 * nome do bot, nome da pousada, cidade e tipos de quarto.
 *
 * O EXPORT NÃO MUDA: continua sendo a string pronta, construída com os
 * defaults da Pousada Luz da Lua — byte-idêntica à versão atual.
 * webhook.js e deepseek-client.js continuam funcionando sem alteração.
 *
 * Uso multi-tenant futuro (Fase 3/4): chamar buildSystemPrompt(opts)
 * diretamente do prompt-builder com os dados do tenant.
 *
 * Fonte canônica: services/luna/system-prompt.js
 */

const { buildSystemPrompt } = require('./prompt-builder');

const LUNA_SYSTEM_PROMPT = buildSystemPrompt();

module.exports = LUNA_SYSTEM_PROMPT;
