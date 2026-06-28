'use strict';

/**
 * PORTA de OCR — a única coisa que o resto do sistema conhece.
 *
 *   extractReceipt(imageB64, mime) → InvoiceImportData (mode 'simple')   [sucesso]
 *                                  | { ok:false, errorType, message }    [falha]
 *
 * Escolhe o provedor por config (OCR_PROVIDER, default 'anthropic'). Trocar de
 * provedor = um arquivo novo em providers/ + uma linha no registro abaixo; a
 * lógica de negócio (endpoint, modal, despesa, parser BR) não muda.
 *
 * A chave de IA é CENTRAL (operação do SaaS), nunca do cliente. Em falha, o
 * detalhe real fica só no log do servidor (operador) — o cliente recebe uma
 * mensagem genérica e o sistema degrada para o lançamento manual. OCR é
 * conveniência, nunca ponto único de falha.
 */

const anthropic = require('./providers/anthropic');
const { normalizeReceipt } = require('./normalize');

const PROVIDERS = {
  anthropic,
  // google_vision: require('./providers/google-vision'),
  // textract:      require('./providers/textract'),
  // tesseract:     require('./providers/tesseract'),
};

function getProvider() {
  const name = String(process.env.OCR_PROVIDER || 'anthropic').toLowerCase();
  return PROVIDERS[name] || anthropic;
}

// Mensagem genérica ao cliente por tipo de erro — NUNCA vaza detalhe interno
// (billing/crédito/provedor). O motivo real vai só pro log do servidor.
function friendlyMessage(errorType) {
  if (errorType === 'bad_image') {
    return 'Não consegui ler a foto — tente outra ou preencha manualmente.';
  }
  // no_credit | provider_down | not_configured | auth | unknown
  return 'Leitura automática indisponível no momento — preencha manualmente.';
}

async function extractReceipt(imageB64, mimeType) {
  const provider = getProvider();
  const r = await provider.read(imageB64, mimeType);

  if (!r.ok) {
    // Detalhe real só para o operador (log do servidor); cliente vê genérico.
    console.warn(`[ocr:${provider.name}] falha ${r.errorType}: ${r.detail || ''}`);
    return { ok: false, errorType: r.errorType, message: friendlyMessage(r.errorType) };
  }

  return normalizeReceipt(r.raw); // { ok:true, ...InvoiceImportData }
}

module.exports = { extractReceipt, friendlyMessage, getProvider, PROVIDERS };
