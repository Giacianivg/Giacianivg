'use strict';

/**
 * Follow-up message templates for abandoned quote scenarios.
 * Each template receives a data object with: name, checkIn, checkOut, roomType, totalAmount
 */
const templates = {
  /**
   * First follow-up: 1 hour after quote was sent
   */
  quote_abandoned_1h: (data) =>
    `Olá ${data.name || 'você'}! 😊 Vi que você recebeu nossa proposta para a Pousada Luz da Lua. Ficou com alguma dúvida sobre a estadia${data.checkIn ? ` de ${data.checkIn}` : ''}? Estou aqui para ajudar e garantir que você tenha a melhor experiência possível. 🌙`,

  /**
   * Second follow-up: 24 hours after quote was sent
   */
  quote_abandoned_24h: (data) =>
    `${data.name || 'Olá'}! Nossa pousada tem recebido ótimas avaliações de quem veio relaxar em Socorro-SP. 🌿 Sua proposta${data.checkIn ? ` para ${data.checkIn}` : ''} ainda está disponível — mas as vagas são limitadas. Posso confirmar sua reserva agora?`,

  /**
   * Third follow-up: 72 hours after quote was sent
   */
  quote_abandoned_72h: (data) =>
    `${data.name || 'Olá'}! Para a sua estadia em ${data.checkIn || 'breve'}, ainda temos disponibilidade na Pousada Luz da Lua. 🌙 Se surgiu algum imprevisto ou quiser ajustar as datas, é só me avisar — adoraríamos recebê-lo(a)!`,
};

module.exports = { templates };
