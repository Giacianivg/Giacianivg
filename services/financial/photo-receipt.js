'use strict';

/**
 * Adapter de FOTO de cupom simples (Compras — Fase 2, Caso A).
 *
 * Cupom de feira/padaria/gás: extrai SÓ o essencial (total, data, estabelecimento)
 * via Claude (visão) — o modelo lida nativamente com foto torta/baixo contraste,
 * então não precisamos de correção de rotação/contraste. mode 'simple' (sem
 * itens) → vira uma DESPESA. É SEMPRE rascunho: a tela abre pré-preenchida com
 * banner de revisão; nada é salvo automaticamente.
 *
 * parseReceiptResponse é puro (testável); importFromPhoto faz a chamada à API.
 */

const { buildImportData } = require('./invoice-import');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const VISION_MODEL = 'claude-haiku-4-5-20251001';

const PROMPT = [
  'Esta é a foto de um cupom/comprovante de compra (feira, padaria, mercado, posto de gás).',
  'Extraia APENAS estes campos e responda SOMENTE com um JSON válido, sem texto antes ou depois:',
  '{',
  '  "total": o valor total pago, como TEXTO entre aspas EXATAMENTE como impresso no cupom (ex: "1.950,00", "84,50", "R$ 12,00") ou null,',
  '  "date": data da compra como "YYYY-MM-DD" ou null,',
  '  "supplier": nome do estabelecimento (string) ou null,',
  '  "confidence": { "total": "high"|"low", "date": "high"|"low", "supplier": "high"|"low" }',
  '}',
  'No Brasil o ponto é separador de MILHAR e a vírgula é o DECIMAL: "1.950,00" são mil novecentos e cinquenta reais (1950), não 1,95.',
  'Use "low" quando não tiver certeza do campo. Se um campo não estiver legível, use null e "low".',
].join('\n');

// Extrai o primeiro objeto JSON de um texto (tolera ```json, texto em volta).
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

// Parse de valor em reais robusto ao formato brasileiro (ponto = milhar,
// vírgula = decimal). Aceita string ("1.950,00", "84,50", "1.950") ou número.
//   "1.950,00" → 1950   |  "84,50" → 84.5   |  "1.950" → 1950 (milhar)
//   "84.50"    → 84.5   |  "1950"  → 1950   |  número 1950 → 1950
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
  }
  let s = String(v).replace(/[^\d.,]/g, '');
  if (!s) return null;

  if (s.includes(',')) {
    // vírgula presente = decimal brasileiro; pontos são separador de milhar.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes('.')) {
    // só pontos: 1–2 dígitos depois do último ponto = decimal; senão = milhar.
    const lastDot = s.lastIndexOf('.');
    const decimals = s.length - lastDot - 1;
    s = (decimals === 1 || decimals === 2)
      ? s.slice(0, lastDot).replace(/\./g, '') + '.' + s.slice(lastDot + 1)
      : s.replace(/\./g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function isoDate(v) {
  const s = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * parseReceiptResponse(text) → InvoiceImportData (mode 'simple') | {ok:false,error}.
 * Recebe o texto da resposta do Claude. Campos ausentes/baixa confiança entram
 * em uncertain_fields para a tela destacar e exigir revisão.
 */
function parseReceiptResponse(text) {
  const j = extractJson(text);
  if (!j) return { ok: false, error: 'Não consegui interpretar a resposta da leitura da foto.' };

  const conf = j.confidence || {};
  const total_amount = num(j.total);
  const issue_date = isoDate(j.date);
  const supplier_name = (j.supplier && String(j.supplier).trim()) || null;

  const uncertain = [];
  if (total_amount === null || conf.total === 'low') uncertain.push('total_amount');
  if (issue_date === null || conf.date === 'low') uncertain.push('issue_date');
  if (!supplier_name || conf.supplier === 'low') uncertain.push('supplier_name');

  const warnings = ['📷 Dados extraídos da foto — confira antes de salvar.'];

  return buildImportData({
    source: 'photo_receipt',
    source_confidence: 'low', // foto é sempre rascunho
    mode: 'simple',
    header: {
      supplier_name,
      total_amount,
      issue_date,
      // demais campos (cnpj, número, série, chave) não se aplicam ao cupom simples
    },
    items: [],
    uncertain_fields: uncertain,
    warnings,
  });
}

/**
 * importFromPhoto(base64, mimeType) → InvoiceImportData (Promise).
 * Chama o Claude (visão) reusando o padrão do webhook.js (fetch direto).
 */
async function importFromPhoto(base64, mimeType) {
  if (!ANTHROPIC_API_KEY) return { ok: false, error: 'Leitura de foto indisponível (ANTHROPIC_API_KEY ausente).' };
  if (!base64) return { ok: false, error: 'Foto vazia.' };

  const safeMime = (mimeType && mimeType.startsWith('image/')) ? mimeType : 'image/jpeg';

  let text;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: safeMime, data: base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return { ok: false, error: `Falha na leitura da foto (HTTP ${res.status}).` };
    const data = await res.json();
    text = data && data.content && data.content[0] && data.content[0].text;
  } catch (e) {
    return { ok: false, error: 'Não consegui ler a foto: ' + e.message };
  }

  return parseReceiptResponse(text);
}

module.exports = { parseReceiptResponse, importFromPhoto, extractJson };
