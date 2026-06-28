'use strict';

/**
 * Adapter de OCR: Anthropic (Claude visão). Sabe falar SÓ com a Anthropic e
 * devolver o contrato comum:
 *   read(imageB64, mime) → { ok:true, raw:{total,date,supplier,confidence} }
 *                        | { ok:false, errorType, detail }
 *
 * A chave de IA é central (env do servidor) — nunca do tenant. Os erros são
 * TIPADOS (errorType) para a porta decidir a mensagem ao cliente sem vazar
 * detalhe interno (ex.: billing).
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-haiku-4-5-20251001';

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

// Mapeia status+corpo da Anthropic para um errorType genérico (sem vazar detalhe).
function mapError(status, body) {
  const msg = (body && body.error && body.error.message) || '';
  if (/credit balance|too low|billing|quota|insufficient/i.test(msg)) return { errorType: 'no_credit', detail: msg };
  if (status === 401 || status === 403) return { errorType: 'auth', detail: msg || `http ${status}` };
  if (status === 400 && /image|media|format|dimension|size|pixel|base64|decode/i.test(msg)) return { errorType: 'bad_image', detail: msg };
  if (status === 429) return { errorType: 'provider_down', detail: msg || 'rate limit' };
  if (status >= 500) return { errorType: 'provider_down', detail: msg || `http ${status}` };
  return { errorType: 'unknown', detail: msg || `http ${status}` };
}

async function read(imageB64, mimeType) {
  if (!ANTHROPIC_API_KEY) return { ok: false, errorType: 'not_configured', detail: 'ANTHROPIC_API_KEY ausente' };
  if (!imageB64) return { ok: false, errorType: 'bad_image', detail: 'imagem vazia' };

  const safeMime = (mimeType && mimeType.startsWith('image/')) ? mimeType : 'image/jpeg';

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: safeMime, data: imageB64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
      signal: AbortSignal.timeout(25000),
    });
  } catch (e) {
    return { ok: false, errorType: 'provider_down', detail: e.message };
  }

  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch (_) { /* ignora */ }
    return { ok: false, ...mapError(res.status, body) };
  }

  let text;
  try {
    const data = await res.json();
    text = data && data.content && data.content[0] && data.content[0].text;
  } catch (_) {
    return { ok: false, errorType: 'unknown', detail: 'resposta ilegível' };
  }

  const j = extractJson(text);
  if (!j) return { ok: false, errorType: 'unknown', detail: 'JSON não encontrado na resposta' };

  return {
    ok: true,
    raw: { total: j.total, date: j.date, supplier: j.supplier, confidence: j.confidence || {} },
  };
}

module.exports = { name: 'anthropic', read, mapError, extractJson };
