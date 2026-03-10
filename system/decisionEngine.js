const LEVELS = {
  LEVEL_1: [
    'price_change',
    'campaign_launch',
    'epic_approval',
    'critical_deploy',
    'guest_impact'
  ],
  LEVEL_2: [
    'feature_implementation',
    'dynamic_pricing',
    'package_creation',
    'service_change',
    'migration_create',
    'external_integration'
  ]
};

function evaluate(decision) {
  const { type, agent, action, impact } = decision;

  if (LEVELS.LEVEL_1.includes(type)) {
    return {
      level: 1,
      status: 'requires_founder',
      message: `⛔ NÍVEL 1 — AGUARDANDO FOUNDER\nDecisão: ${action}\nAgente: ${agent}\nImpacto: ${impact || 'não informado'}`
    };
  }

  if (LEVELS.LEVEL_2.includes(type)) {
    return {
      level: 2,
      status: 'requires_board_then_founder',
      message: `⚠️ NÍVEL 2 — Requer votação do board e aprovação do founder\nAção: ${action}`
    };
  }

  return {
    level: 3,
    status: 'approved',
    message: `✅ NÍVEL 3 — Autônomo. Executando: ${action}`
  };
}

module.exports = { evaluate, LEVELS };
