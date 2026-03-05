'use strict';

/**
 * Teste do fluxo completo de qualificacao -> cotacao
 * PLU-01.3 -- T6.1: cenarios de teste do motor de cotacao
 *
 * Importa diretamente de quotation.js para testar o codigo de producao.
 *
 * Uso: node test-quotation-flow.js
 */

const { calculateQuotation, formatWhatsAppMessage } = require('../webhook/quotation');

// ---------------------------------------------------------------------------
// Cenarios de Teste
// ---------------------------------------------------------------------------
const TEST_SCENARIOS = [
  // --- Basicos: baixa temporada ---
  {
    id: 'T-FUN-01',
    desc: 'Casal 2 noites ALA_A baixa temporada',
    p: { data_entrada: '10/03/2026', data_saida: '12/03/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { nights: 2, total: 600 },
  },
  {
    id: 'T-FUN-02',
    desc: 'Familia 3 noites ALA_B com fds (sexta+sabado+domingo)',
    p: { data_entrada: '13/03/2026', data_saida: '16/03/2026', pessoas: 4, tipo: 'ALA_B' },
    expect: { nights: 3 },
  },
  {
    id: 'T-FUN-03',
    desc: 'Casal 7 noites ALA_A (desconto 10%)',
    p: { data_entrada: '10/03/2026', data_saida: '17/03/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { nights: 7, desconto: 10 },
  },
  {
    id: 'T-FUN-04',
    desc: 'Casal 14 noites ALA_A (desconto 15%)',
    p: { data_entrada: '01/03/2026', data_saida: '15/03/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { nights: 14, desconto: 15 },
  },

  // --- Temporadas ---
  {
    id: 'T-FUN-05',
    desc: 'Alta temporada julho ALA_A 2 pax',
    p: { data_entrada: '10/07/2026', data_saida: '12/07/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { season: 'alta', total: 800 },
  },
  // T-FUN-06 atualizado: min noites -- check-in sabado com 1 noite deve retornar erro (DB-12)
  {
    id: 'T-FUN-06',
    desc: 'Minimo 2 noites: check-in sabado com 1 noite -> erro',
    p: { data_entrada: '14/03/2026', data_saida: '15/03/2026', pessoas: 2, tipo: 'ALA_B' },
    expect: { error: true, minNights: 2 },
  },
  {
    id: 'T-FUN-07',
    desc: 'ALA_C_CASAL padrao',
    p: { data_entrada: '10/03/2026', data_saida: '12/03/2026', pessoas: 2, tipo: 'ALA_C_CASAL' },
    expect: { nights: 2, total: 600 },
  },

  // --- Grupo / Escalonamento ---
  {
    id: 'T-FUN-08',
    desc: 'ALA_C_GRUPO deve escalar para humano',
    p: { data_entrada: '10/03/2026', data_saida: '12/03/2026', pessoas: 8, tipo: 'ALA_C_GRUPO' },
    expect: { escalar: true },
  },

  // --- Datas invalidas ---
  {
    id: 'T-FUN-09',
    desc: 'Datas invertidas (erro)',
    p: { data_entrada: '15/03/2026', data_saida: '10/03/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { error: true },
  },
  {
    id: 'T-FUN-10',
    desc: 'Check-in = check-out (erro)',
    p: { data_entrada: '10/03/2026', data_saida: '10/03/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { error: true },
  },

  // --- Capacidade maxima ---
  {
    id: 'T-FUN-11',
    desc: '3 pessoas ALA_A baixa -- sem preco por pessoa (preco fixo)',
    p: { data_entrada: '10/03/2026', data_saida: '12/03/2026', pessoas: 3, tipo: 'ALA_A' },
    expect: { nights: 2, total: 600 },
  },
  {
    id: 'T-FUN-12',
    desc: '5 pessoas ALA_B (capacidade maxima)',
    p: { data_entrada: '10/03/2026', data_saida: '12/03/2026', pessoas: 5, tipo: 'ALA_B' },
    expect: { nights: 2 },
  },

  // --- Periodos longos ---
  {
    id: 'T-FUN-13',
    desc: '1 semana ALA_B familia (alta temporada)',
    p: { data_entrada: '01/07/2026', data_saida: '08/07/2026', pessoas: 4, tipo: 'ALA_B' },
    expect: { nights: 7, desconto: 10 },
  },
  {
    id: 'T-FUN-14',
    desc: '5 noites sem desconto ALA_A',
    p: { data_entrada: '10/03/2026', data_saida: '15/03/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { nights: 5, desconto: 0 },
  },

  // --- Dezembro/Janeiro (alta) ---
  {
    id: 'T-FUN-15',
    desc: 'Dezembro alta temporada ALA_A',
    p: { data_entrada: '20/12/2026', data_saida: '22/12/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { season: 'alta' },
  },
  {
    id: 'T-FUN-16',
    desc: 'Janeiro alta temporada ALA_B',
    p: { data_entrada: '05/01/2026', data_saida: '08/01/2026', pessoas: 3, tipo: 'ALA_B' },
    expect: { season: 'alta' },
  },

  // --- Formato de mensagem ---
  {
    id: 'T-FUN-17',
    desc: 'Mensagem WhatsApp gerada corretamente',
    p: { data_entrada: '10/03/2026', data_saida: '12/03/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { hasTemplate: true },
  },
  {
    id: 'T-FUN-18',
    desc: 'Mensagem inclui link do site',
    p: { data_entrada: '10/03/2026', data_saida: '12/03/2026', pessoas: 2, tipo: 'ALA_B' },
    expect: { hasLink: true },
  },
  {
    id: 'T-FUN-19',
    desc: 'Mensagem inclui CONFIRMAR',
    p: { data_entrada: '10/03/2026', data_saida: '12/03/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { hasConfirmar: true },
  },
  {
    id: 'T-FUN-20',
    desc: 'Calculo correto 7 noites periodo misto ALA_A (tudo R$300)',
    p: { data_entrada: '10/03/2026', data_saida: '17/03/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { nights: 7, desconto: 10, total: 1890 },
  },

  // --- Preco por pessoa em alta temporada (novos) ---
  {
    id: 'T-FUN-21',
    desc: '3 pax alta temporada ALA_A -- preco por pessoa (R$400 + R$150)',
    p: { data_entrada: '04/07/2026', data_saida: '07/07/2026', pessoas: 3, tipo: 'ALA_A' },
    expect: { nights: 3, total: 1650 },
  },
  {
    id: 'T-FUN-22',
    desc: '2 pax alta temporada ALA_A -- preco base casal (R$400)',
    p: { data_entrada: '04/07/2026', data_saida: '07/07/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { nights: 3, total: 1200 },
  },
  {
    id: 'T-FUN-23',
    desc: 'Minimo 2 noites: alta temporada com 1 noite -> erro (DB-12)',
    p: { data_entrada: '01/07/2026', data_saida: '02/07/2026', pessoas: 2, tipo: 'ALA_A' },
    expect: { error: true, minNights: 2 },
  },
  {
    id: 'T-FUN-24',
    desc: 'Prorateio ALA_B 7 noites misto: 5x baixa(R$300) + 2x media(R$350) = R$1980',
    p: { data_entrada: '10/03/2026', data_saida: '17/03/2026', pessoas: 2, tipo: 'ALA_B' },
    expect: { nights: 7, desconto: 10, total: 1980 },
  },
];

// ---------------------------------------------------------------------------
// Executor de testes
// ---------------------------------------------------------------------------
function runTests() {
  console.log('\n\uD83D\uDCB0 Testando Motor de Cotacao -- Pousada Luz da Lua');
  console.log('='.repeat(60));
  console.log(`Total de cenarios: ${TEST_SCENARIOS.length}\n`);

  let pass = 0;
  let fail = 0;

  for (const scenario of TEST_SCENARIOS) {
    const result = calculateQuotation(scenario.p);
    const { expect } = scenario;
    let ok = true;
    const failures = [];

    if (expect.error && !result.error) { ok = false; failures.push('esperava erro'); }
    if (expect.escalar && !result.escalar) { ok = false; failures.push('esperava escalonamento'); }
    if (!expect.error && !expect.escalar && result.error) { ok = false; failures.push(`erro inesperado: ${result.error}`); }

    if (result.error && expect.minNights !== undefined && result.minNights !== expect.minNights) {
      ok = false; failures.push(`minNights: ${result.minNights} != ${expect.minNights}`);
    }

    if (!result.error && !result.escalar) {
      if (expect.nights !== undefined && result.nights !== expect.nights) { ok = false; failures.push(`nights: ${result.nights} != ${expect.nights}`); }
      if (expect.total !== undefined && result.totalFinal !== expect.total) { ok = false; failures.push(`total: R$${result.totalFinal} != R$${expect.total}`); }
      if (expect.desconto !== undefined && result.desconto !== expect.desconto) { ok = false; failures.push(`desconto: ${result.desconto}% != ${expect.desconto}%`); }
      if (expect.season !== undefined && result.season !== expect.season) { ok = false; failures.push(`season: ${result.season} != ${expect.season}`); }

      if (expect.hasTemplate || expect.hasLink || expect.hasConfirmar) {
        const msg = formatWhatsAppMessage(result);
        if (expect.hasTemplate && !msg.includes('Cota')) { ok = false; failures.push('falta header de cotacao'); }
        if (expect.hasLink && !msg.includes('pousadaluzdaluasp')) { ok = false; failures.push('falta link do site'); }
        if (expect.hasConfirmar && !msg.includes('CONFIRMAR')) { ok = false; failures.push('falta instrucao CONFIRMAR'); }
      }
    }

    const status = ok ? '\u2705' : '\u274C';
    const detail = ok ? '' : ` -> ${failures.join(', ')}`;
    console.log(`[${scenario.id}] ${status} ${scenario.desc}${detail}`);

    if (ok) pass++; else fail++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n\uD83D\uDCCA RESULTADO: ${pass}/${TEST_SCENARIOS.length} OK | ${fail} falhas\n`);

  // Exemplo de mensagem formatada com prorateio misto
  console.log('\uD83D\uDCF1 Exemplo -- cotacao ALA_B periodo misto (7 noites):');
  console.log('-'.repeat(60));
  const exemplo = calculateQuotation({ data_entrada: '10/03/2026', data_saida: '17/03/2026', pessoas: 2, tipo: 'ALA_B' });
  console.log(formatWhatsAppMessage(exemplo));
  console.log('-'.repeat(60));

  console.log('\n\uD83D\uDCF1 Exemplo -- cotacao alta temporada 3 pax (prorateio por pessoa):');
  console.log('-'.repeat(60));
  const exemploAlta = calculateQuotation({ data_entrada: '04/07/2026', data_saida: '07/07/2026', pessoas: 3, tipo: 'ALA_A' });
  console.log(formatWhatsAppMessage(exemploAlta));
  console.log('-'.repeat(60));

  return fail === 0;
}

const success = runTests();
process.exit(success ? 0 : 1);
