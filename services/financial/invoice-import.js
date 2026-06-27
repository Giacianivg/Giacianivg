'use strict';

/**
 * Importação de notas/comprovantes de MÚLTIPLAS FONTES — fundação.
 *
 * Toda fonte (XML, PDF DANFE, foto de cupom, foto de DANFE) é um ADAPTER que
 * devolve o MESMO objeto `InvoiceImportData`. A tela de revisão, a classificação
 * e o cálculo do business_amount consomem só esse objeto — nunca olham a origem.
 * Adicionar um formato novo = um adapter novo, sem tocar na lógica de negócio.
 *
 * ── InvoiceImportData ────────────────────────────────────────────────────────
 * {
 *   ok: true,
 *   source: 'xml' | 'pdf_text' | 'pdf_ocr' | 'photo_receipt' | 'photo_danfe',
 *   source_confidence: 'high' | 'medium' | 'low',
 *   mode: 'itemized' | 'simple',     // itemized = nota c/ produtos; simple = despesa direta (cupom)
 *   header: {
 *     supplier_name, supplier_cnpj, invoice_number, series,
 *     issue_date, total_amount, payment_method, access_key,   // access_key = nfe_key (44) ou null
 *   },
 *   items: [ { product_code, description, ncm, cfop, quantity, unit, unit_price, total_price } ],
 *   uncertain_fields: [ 'total_amount', 'items[2].quantity' ],  // destaque p/ revisão manual
 *   warnings: [ '...' ],
 * }
 * | { ok: false, error: '...' }
 *
 * A unificação cupom × nota: "uma compra é uma lista de linhas classificáveis".
 * Nota → N linhas (os itens). Cupom → 0 itens aqui (mode 'simple'); na hora de
 * classificar, vale como 1 linha = a compra inteira. Mesmo business_amount.
 */

const { parseNfe } = require('./nfe-parser');
const { parseDanfeText } = require('./danfe-text-parser');

const SOURCES = ['xml', 'pdf_text', 'pdf_ocr', 'photo_receipt', 'photo_danfe'];
const CONFIDENCES = ['high', 'medium', 'low'];
const MODES = ['itemized', 'simple'];

const EMPTY_HEADER = {
  supplier_name: null,
  supplier_cnpj: null,
  invoice_number: null,
  series: null,
  issue_date: null,
  total_amount: null,
  payment_method: null,
  access_key: null,
};

function round2(n) {
  return n == null ? null : Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Normaliza um objeto parcial num InvoiceImportData consistente. Garante header
 * completo, items/uncertain_fields/warnings como arrays, e mode coerente com
 * a presença de itens (sem itens ⇒ 'simple').
 */
function buildImportData(partial = {}) {
  const header = { ...EMPTY_HEADER, ...(partial.header || {}) };
  header.total_amount = round2(header.total_amount);

  const items = Array.isArray(partial.items) ? partial.items : [];
  const source = SOURCES.includes(partial.source) ? partial.source : 'xml';
  const source_confidence = CONFIDENCES.includes(partial.source_confidence)
    ? partial.source_confidence
    : 'high';
  // Sem itens ⇒ despesa simples; com itens ⇒ itemizada (a não ser que o adapter force).
  let mode = MODES.includes(partial.mode) ? partial.mode : (items.length ? 'itemized' : 'simple');
  if (items.length === 0 && mode === 'itemized') mode = 'simple';

  return {
    ok: true,
    source,
    source_confidence,
    mode,
    header,
    items,
    uncertain_fields: Array.isArray(partial.uncertain_fields) ? partial.uncertain_fields : [],
    warnings: Array.isArray(partial.warnings) ? partial.warnings : [],
  };
}

// Soma dos itens confere com o total declarado? (tolerância p/ frete/desconto).
// Devolve um warning quando diverge muito — sinaliza revisão, não bloqueia.
function totalMismatchWarning(totalAmount, items) {
  if (totalAmount == null || !items.length) return null;
  const sum = round2(items.reduce((s, i) => s + (Number(i.total_price) || 0), 0));
  const diff = Math.abs(round2(totalAmount) - sum);
  // > 1% e > R$1 de diferença → vale conferir (frete/desconto costuma ser menor).
  if (diff > 1 && diff > round2(totalAmount) * 0.01) {
    return `Soma dos itens (R$ ${sum}) difere do total da nota (R$ ${round2(totalAmount)}).`;
  }
  return null;
}

// ── Adapter: XML (NF-e/NFC-e) ────────────────────────────────────────────────
// Primeiro adapter. Reusa o parser canônico e mapeia para InvoiceImportData.
function importFromXml(xmlText) {
  const r = parseNfe(xmlText);
  if (!r.ok) return { ok: false, error: r.error };

  const inv = r.invoice;
  const warnings = [];
  const w = totalMismatchWarning(inv.total_amount, r.items);
  if (w) warnings.push(w);

  return buildImportData({
    source: 'xml',
    source_confidence: 'high',
    mode: 'itemized',
    header: {
      supplier_name: inv.supplier_name,
      supplier_cnpj: inv.supplier_cnpj,
      invoice_number: inv.invoice_number,
      series: inv.series || null,
      issue_date: inv.issue_date,
      total_amount: inv.total_amount,
      payment_method: null,        // XML não traz forma de pgto confiável
      access_key: inv.nfe_key,
    },
    items: r.items,
    uncertain_fields: [],          // XML é estruturado: nada incerto
    warnings,
  });
}

// ── Adapter: PDF da DANFE (texto pesquisável) ────────────────────────────────
// Fase 1. Extrai o texto do PDF no servidor e delega ao parser canônico de DANFE.
// Sem OCR: PDF imagem (sem texto) retorna erro claro (OCR fica para a Fase 2).
async function importFromPdf(buffer) {
  let text;
  try {
    // unpdf: extração de texto baseada em pdfjs serverless — SEM dependência
    // nativa (roda em serverless/Vercel). ESM → import dinâmico a partir do CJS.
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const r = await extractText(pdf, { mergePages: true });
    text = Array.isArray(r.text) ? r.text.join('\n') : r.text;
  } catch (e) {
    return { ok: false, error: 'Não consegui ler o PDF: ' + e.message };
  }

  const parsed = parseDanfeText(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  return buildImportData({
    source: 'pdf_text',
    source_confidence: parsed.source_confidence,
    mode: 'itemized',
    header: parsed.header,
    items: parsed.items,
    uncertain_fields: parsed.uncertain_fields,
    warnings: parsed.warnings,
  });
}

// ── Dispatcher: escolhe o adapter pela fonte do input ────────────────────────
// input: { xml } | { pdf_base64 }. Retorna InvoiceImportData (Promise).
async function importInvoice(input = {}) {
  if (input.xml) return importFromXml(input.xml);
  if (input.pdf_base64) {
    let buf;
    try {
      buf = Buffer.from(String(input.pdf_base64), 'base64');
    } catch (_) {
      return { ok: false, error: 'PDF inválido (base64).' };
    }
    if (!buf || !buf.length) return { ok: false, error: 'PDF vazio.' };
    return importFromPdf(buf);
  }
  return { ok: false, error: 'Envie um XML ou um PDF.' };
}

module.exports = {
  SOURCES,
  CONFIDENCES,
  MODES,
  buildImportData,
  totalMismatchWarning,
  importFromXml,
  importFromPdf,
  importInvoice,
};
