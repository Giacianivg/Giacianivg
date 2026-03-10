const eventBus = require('../../system/eventBus');

eventBus.on('lead_received', async (lead) => {
  console.log('[crmAgent] Lead recebido:', lead.phone, '| score:', lead.score || 'N/A');
});

eventBus.on('lead_scored', async ({ leadId, name, phone, score, label }) => {
  console.log(`[crmAgent] Lead scored: ${name} | ${score}/100 | ${label}`);
});

eventBus.on('booking_confirmed', async ({ bookingId, guestName }) => {
  console.log(`[crmAgent] Reserva confirmada: ${guestName} | ID: ${bookingId}`);
});

console.log('[crmAgent] Ativo — escutando lead_received, lead_scored, booking_confirmed');

module.exports = {};
