'use strict';

/**
 * Follow-up message templates.
 * Each template receives a data object with: name, checkIn, checkOut, roomType, totalAmount
 *
 * Branding (nome da pousada, cidade) vem de services/settings/branding.js —
 * lido da tabela `settings` com fallback nos valores da Pousada Luz da Lua.
 *
 * Types:
 *   quote_abandoned_*  — cotação enviada, sem resposta
 *   reactivation_d*    — pós-estadia, sequência de reativação
 */
const { getBranding } = require('../settings/branding');

const templates = {
  // ---------------------------------------------------------------------------
  // Cotação abandonada
  // ---------------------------------------------------------------------------

  /** D+0 +1h: cotação enviada, sem resposta */
  quote_abandoned_1h: (data) => {
    const b = getBranding();
    return `Olá ${data.name || 'você'}! 😊 Vi que você recebeu nossa proposta para a ${b.inn_name}. Ficou com alguma dúvida sobre a estadia${data.checkIn ? ` de ${data.checkIn}` : ''}? Estou aqui para ajudar e garantir que você tenha a melhor experiência possível. 🌙`;
  },

  /** D+1: cotação enviada, sem resposta */
  quote_abandoned_24h: (data) => {
    const b = getBranding();
    return `${data.name || 'Olá'}! Nossa pousada tem recebido ótimas avaliações de quem veio relaxar em ${b.city}. 🌿 Sua proposta${data.checkIn ? ` para ${data.checkIn}` : ''} ainda está disponível — mas as vagas são limitadas. Posso confirmar sua reserva agora?`;
  },

  /** D+3: última tentativa de cotação */
  quote_abandoned_72h: (data) => {
    const b = getBranding();
    return `${data.name || 'Olá'}! Para a sua estadia em ${data.checkIn || 'breve'}, ainda temos disponibilidade na ${b.inn_name}. 🌙 Se surgiu algum imprevisto ou quiser ajustar as datas, é só me avisar — adoraríamos recebê-lo(a)!`;
  },

  // ---------------------------------------------------------------------------
  // Reativação pós-estadia — sequência D+1, D+7, D+30, D+60, D+90
  // ---------------------------------------------------------------------------

  /** D+1 após checkout: agradecimento e pedido de avaliação */
  reactivation_d1: (data) => {
    const b = getBranding();
    return `${data.name || 'Olá'}! Esperamos que sua estadia na ${b.inn_name} tenha sido inesquecível. 🌙✨ Sua opinião é muito importante para nós — se puder deixar uma avaliação no Google, ficamos muito gratos! E qualquer dúvida é só chamar.`;
  },

  /** D+7: NPS e próxima visita */
  reactivation_d7: (data) => {
    const b = getBranding();
    return `Oi${data.name ? ` ${data.name}` : ''}! Faz uma semana desde sua visita à ${b.inn_short_name}. 🌿 De 0 a 10, o quanto você nos recomendaria para amigos ou familiares? Adoraríamos saber sua experiência!`;
  },

  /** D+30: oferta de retorno */
  reactivation_d30: (data) => {
    const b = getBranding();
    return `${data.name || 'Olá'}! 🌙 Já faz um mês desde sua estadia em ${b.city}. Sentimos sua falta por aqui! Se estiver pensando em uma nova escapada, posso verificar disponibilidade e preparar uma proposta especial para você. Quando seria a próxima visita?`;
  },

  /** D+60: campanha de reativação */
  reactivation_d60: (data) => {
    const b = getBranding();
    return `Oi${data.name ? ` ${data.name}` : ''}! Temos novidades na ${b.inn_name} e adoraríamos recebê-lo(a) novamente. 🌿 Está planejando alguma viagem em breve? Posso ajudar a encontrar as melhores datas para você!`;
  },

  /** D+90: última tentativa de reativação */
  reactivation_d90: (data) => {
    const b = getBranding();
    return `${data.name || 'Olá'}! Passaram 3 meses desde sua visita à ${b.inn_short_name}. 🌙 Que tal planejar um novo momento de descanso em ${b.city}? Temos disponibilidade e ficamos felizes em recebê-lo(a) novamente. É só chamar!`;
  },
};

module.exports = { templates };
