'use strict';

/**
 * Normalização de cupom (comum a QUALQUER provedor de OCR).
 *
 * Recebe os campos crus que o adapter extraiu — { total, date, supplier,
 * confidence } — e monta o InvoiceImportData (mode 'simple'). Aqui moram as
 * regras de negócio independentes de provedor: parser de valor em formato
 * brasileiro, validação de data, e os uncertain_fields para a revisão.
 */

const { buildImportData } = require('../invoice-import');

// Valor em reais robusto ao formato brasileiro (ponto = milhar, vírgula = decimal).
// Aceita string ("1.950,00", "84,50", "1.950") ou número.
//   "1.950,00" → 1950  |  "84,50" → 84.5  |  "1.950" → 1950 (milhar)  |  1950 → 1950
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
  }
  let s = String(v).replace(/[^\d.,]/g, '');
  if (!s) return null;

  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');           // vírgula = decimal; pontos = milhar
  } else if (s.includes('.')) {
    const lastDot = s.lastIndexOf('.');
    const decimals = s.length - lastDot - 1;
    s = (decimals === 1 || decimals === 2)                // 1–2 casas = decimal; senão milhar
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
 * normalizeReceipt(raw) → InvoiceImportData (mode 'simple').
 * raw: { total, date, supplier, confidence: { total, date, supplier } }
 * Campos ausentes ou de baixa confiança entram em uncertain_fields.
 */
function normalizeReceipt(raw = {}) {
  const conf = raw.confidence || {};
  const total_amount = num(raw.total);
  const issue_date = isoDate(raw.date);
  const supplier_name = (raw.supplier && String(raw.supplier).trim()) || null;

  const uncertain = [];
  if (total_amount === null || conf.total === 'low') uncertain.push('total_amount');
  if (issue_date === null || conf.date === 'low') uncertain.push('issue_date');
  if (!supplier_name || conf.supplier === 'low') uncertain.push('supplier_name');

  return buildImportData({
    source: 'photo_receipt',
    source_confidence: 'low', // foto é sempre rascunho
    mode: 'simple',
    header: { supplier_name, total_amount, issue_date },
    items: [],
    uncertain_fields: uncertain,
    warnings: ['📷 Dados extraídos da foto — confira antes de salvar.'],
  });
}

module.exports = { normalizeReceipt, num, isoDate };
