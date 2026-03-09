'use strict';

// Cron: executa processScheduledFollowUps() a cada 15 minutos
// Usa setInterval simples (sem node-cron, que não está no package.json)

const { processScheduledFollowUps } = require('./follow-up-executor');

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

async function runFollowUpCron() {
  try {
    const result = await processScheduledFollowUps();
    console.log('[follow-up-cron]', result);
  } catch (err) {
    console.error('[follow-up-cron] Error:', err.message);
  }
}

// Exporta a função de start para ser chamada em server.js ou manualmente
function startFollowUpCron() {
  console.log('[follow-up-cron] Started — interval: 15 minutes');
  return setInterval(runFollowUpCron, INTERVAL_MS);
}

module.exports = { startFollowUpCron, runFollowUpCron };
