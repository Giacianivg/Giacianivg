'use strict';

/**
 * Teste manual do system prompt do Claude (Luna)
 * PLU-01.2 — T2.4: Testar 30+ perguntas antes de ativar no Make.com
 *
 * Uso: node test-system-prompt.js
 * Requer: ANTHROPIC_API_KEY e DEEPSEEK_API_KEY no .env
 */

require('dotenv').config({ path: '../../.env' });
const fs = require('fs');
const path = require('path');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Carrega o system prompt do arquivo de arquitetura
const SYSTEM_PROMPT_PATH = path.join(__dirname, '../../docs/architecture/claude-system-prompt.md');
const systemPromptFile = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');

// Extrai apenas o conteúdo entre os backticks do System Prompt Completo
const match = systemPromptFile.match(/```\n([\s\S]*?)\n```/);
const SYSTEM_PROMPT = match ? match[1] : '';

if (!SYSTEM_PROMPT) {
  console.error('❌ System prompt não encontrado em claude-system-prompt.md');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 30+ Cenários de Teste (T2.4)
// ---------------------------------------------------------------------------
const TEST_CASES = [
  // --- FAQs simples (esperado: DeepSeek em produção) ---
  { id: 'TC-01', category: 'FAQ', msg: 'Oi, tudo bem?', expect: 'apresentacao_luna' },
  { id: 'TC-02', category: 'FAQ', msg: 'Onde fica a pousada?', expect: 'socorro_sp' },
  { id: 'TC-03', category: 'FAQ', msg: 'Como chegar de São Paulo?', expect: 'km_ou_horas' },
  { id: 'TC-04', category: 'FAQ', msg: 'Qual o horário de check-in?', expect: '14h' },
  { id: 'TC-05', category: 'FAQ', msg: 'Aceita pets?', expect: 'escalar_ou_verificar' },
  { id: 'TC-06', category: 'FAQ', msg: 'Tem estacionamento?', expect: 'estacionamento' },
  { id: 'TC-07', category: 'FAQ', msg: 'Tem piscina?', expect: 'verificar' },
  { id: 'TC-08', category: 'FAQ', msg: 'O café da manhã está incluso?', expect: 'sim_incluso' },
  { id: 'TC-09', category: 'FAQ', msg: 'Qual a política de cancelamento?', expect: '7_dias' },
  { id: 'TC-10', category: 'FAQ', msg: 'Tem Wi-Fi na pousada?', expect: 'wifi' },

  // --- Quartos e capacidade ---
  { id: 'TC-11', category: 'QUARTOS', msg: 'Quais tipos de quarto vocês têm?', expect: 'ala_abc' },
  { id: 'TC-12', category: 'QUARTOS', msg: 'Tenho uma família de 4 pessoas, qual quarto indicam?', expect: 'ala_b' },
  { id: 'TC-13', category: 'QUARTOS', msg: 'Somos 2 pessoas, casal', expect: 'ala_a' },
  { id: 'TC-14', category: 'QUARTOS', msg: 'Quantas pessoas cabem no quarto maior?', expect: 'capacidade' },
  { id: 'TC-15', category: 'QUARTOS', msg: 'Temos um grupo de 20 pessoas para evento', expect: '[ESCALAR]' },

  // --- Cotação / Reserva ---
  { id: 'TC-16', category: 'COTACAO', msg: 'Quero fazer uma reserva', expect: 'passo_1_datas' },
  { id: 'TC-17', category: 'COTACAO', msg: 'Qual o preço da diária?', expect: 'preco_ala' },
  { id: 'TC-18', category: 'COTACAO', msg: 'Tem disponibilidade para o feriado de Carnaval?', expect: 'verificar_datas' },
  { id: 'TC-19', category: 'COTACAO', msg: 'Quanto custa para 3 pessoas em março?', expect: 'qualificacao' },
  { id: 'TC-20', category: 'COTACAO', msg: 'De 10/04 a 12/04 para 2 pessoas, tem disponível?', expect: '[COTAR]' },

  // --- Escalonamento ---
  { id: 'TC-21', category: 'ESCALAMENTO', msg: 'Quero falar com um humano', expect: '[ESCALAR]' },
  { id: 'TC-22', category: 'ESCALAMENTO', msg: 'Estou insatisfeito com o atendimento anterior', expect: '[ESCALAR]' },
  { id: 'TC-23', category: 'ESCALAMENTO', msg: 'Preciso de decoração especial para proposta de casamento', expect: '[ESCALAR]' },
  { id: 'TC-24', category: 'ESCALAMENTO', msg: 'Quero contratar o espaço para uma festa de 50 pessoas', expect: '[ESCALAR]' },
  { id: 'TC-25', category: 'ESCALAMENTO', msg: 'Quero falar com a recepcionista', expect: '[ESCALAR]' },

  // --- Tom e qualidade ---
  { id: 'TC-26', category: 'TOM', msg: 'Bom dia! Estou de férias e quero conhecer Socorro!', expect: 'acolhedor' },
  { id: 'TC-27', category: 'TOM', msg: 'Sua pousada parece incrível, anseio ir!', expect: 'entusiasmo_acolhedor' },
  { id: 'TC-28', category: 'TOM', msg: 'Cadê vocês, nunca atendem!', expect: 'empatico_escalar' },

  // --- Casos extremos ---
  { id: 'TC-29', category: 'EDGE', msg: 'Olá 😊', expect: 'apresentacao_ou_pergunta' },
  { id: 'TC-30', category: 'EDGE', msg: 'Ok', expect: 'clarificacao' },
  { id: 'TC-31', category: 'EDGE', msg: 'Não entendi nada do que você disse', expect: 'clarificacao_acolhedora' },
  { id: 'TC-32', category: 'EDGE', msg: 'Quanto é uma suíte presidencial?', expect: 'nao_existe_escalar' },
];

// ---------------------------------------------------------------------------
// Função para chamar a API (Claude ou DeepSeek)
// ---------------------------------------------------------------------------
async function callClaude(message) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callDeepSeek(message) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 512,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Executor de testes
// ---------------------------------------------------------------------------
async function runTests() {
  const useDeepSeek = process.argv.includes('--deepseek');
  const apiName = useDeepSeek ? 'DeepSeek' : 'Claude Sonnet 4.6';
  const callApi = useDeepSeek ? callDeepSeek : callClaude;

  console.log(`\n🌙 Testando System Prompt da Luna — ${apiName}`);
  console.log('='.repeat(60));
  console.log(`Total de cenários: ${TEST_CASES.length}\n`);

  const results = [];
  let pass = 0;
  let fail = 0;

  for (const tc of TEST_CASES) {
    process.stdout.write(`[${tc.id}] ${tc.category.padEnd(12)} "${tc.msg.substring(0, 40)}"... `);

    try {
      const response = await callApi(tc.msg);
      const hasEscalar = response.includes('[ESCALAR]');
      const hasCotar = response.includes('[COTAR');
      const isShort = response.length < 600; // máx. 3 parágrafos

      results.push({ ...tc, response, hasEscalar, hasCotar, isShort, error: null });

      const flags = [
        hasEscalar ? '🔴 ESCALAR' : '',
        hasCotar ? '💰 COTAR' : '',
        !isShort ? '⚠️ LONGA' : '',
      ].filter(Boolean).join(' ');

      console.log(`✅ OK ${flags}`);
      pass++;
    } catch (err) {
      results.push({ ...tc, response: null, error: err.message });
      console.log(`❌ ERRO: ${err.message.substring(0, 60)}`);
      fail++;
    }

    // Respeitar rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  // Relatório
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 RESULTADO: ${pass}/${TEST_CASES.length} OK | ${fail} erros\n`);

  // Mostrar respostas completas para casos de escalonamento (verificação manual)
  const escalares = results.filter((r) => r.hasEscalar);
  if (escalares.length > 0) {
    console.log(`\n🔴 Casos com [ESCALAR] (${escalares.length}):`);
    escalares.forEach((r) => {
      console.log(`  ${r.id}: "${r.msg}"`);
      console.log(`  → ${r.response?.substring(0, 120)}...\n`);
    });
  }

  // Salvar relatório completo
  const reportPath = path.join(__dirname, `../../docs/qa/system-prompt-test-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ api: apiName, results, summary: { pass, fail, total: TEST_CASES.length } }, null, 2));
  console.log(`\n📄 Relatório completo salvo em: ${reportPath}`);
}

runTests().catch(console.error);
