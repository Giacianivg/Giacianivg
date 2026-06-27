'use strict';

/**
 * Parser de TEXTO de DANFE (PDF com texto pesquisável) → estrutura crua.
 *
 * Puro: recebe o texto JÁ extraído do PDF (a extração I/O fica no adapter, em
 * invoice-import.js). Calibrado em DANFE real (layout nacional SEFAZ). A chave de
 * acesso (44 díg) carrega CNPJ do emitente, série e número — fonte mais confiável
 * que ler rótulos. A validação soma-dos-itens × total sinaliza a confiança: se
 * não bate, marca revisão (confidence 'medium' + warning), nunca importa cego.
 */

// Item: codigo desc NCM(8) CST(3) CFOP(3-4) UNID QTD VUNIT DESC VTOTAL BC VICMS ALIQ_ICMS ALIQ_IPI
// Global (sem ^): casa o item em qualquer ponto do texto — robusto a extrações
// que preservam quebras de linha (pdf-parse) ou entregam texto corrido (unpdf).
// As 2 alíquotas finais (com PONTO decimal) ancoram o fim de cada item.
// UNID flexível ([A-Z0-9]+): casa 'UN', 'KG' e codificações tipo 'CX012UN'.
const ITEM_RE = /(\d{3,})\s+(.+?)\s+(\d{8})\s+(\d{3})\s+(\d{3,4})\s+([A-Z0-9]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+[\d.,]+\s+[\d.,]+\s+\d+\.\d{2}\s+\d+\.\d{2}/g;

function brNum(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function round2(n) { return n == null ? null : Math.round(n * 100) / 100; }

// Chave de acesso (44 díg) — no texto vem em 11 grupos de 4. Fallback: 44 seguidos.
function extractAccessKey(text) {
  const grouped = text.replace(/[^\d\s]/g, ' ').match(/(?:\d{4}\s+){10}\d{4}/);
  if (grouped) return grouped[0].replace(/\s/g, '');
  const solid = text.replace(/\D/g, '').match(/\d{44}/);
  return solid ? solid[0] : null;
}

// A chave NF-e carrega: CNPJ emitente (díg 7-20), série (23-25), número (26-34).
function fieldsFromKey(key) {
  if (!key || key.length !== 44) return null;
  return {
    cnpj: key.slice(6, 20),
    series: String(Number(key.slice(22, 25))),
    number: String(Number(key.slice(25, 34))),
  };
}

function parseDanfeText(text) {
  if (!text || typeof text !== 'string' || text.replace(/\s/g, '').length < 200) {
    return { ok: false, error: 'PDF sem texto pesquisável (provável imagem escaneada). OCR só na Fase 2.' };
  }

  const uncertain = [];
  const warnings = [];

  // ── Chave + campos derivados dela ──
  const access_key = extractAccessKey(text);
  const fromKey = fieldsFromKey(access_key);
  if (!access_key) uncertain.push('access_key');

  // ── Fornecedor (emitente): o canhoto "RECEBEMOS DE <nome> OS PRODUTOS" é
  // padrão da DANFE e robusto mesmo em texto corrido. Fallback: trecho antes de
  // "DANFE", cortado no início do logradouro.
  let supplier_name = null;
  const rcb = text.match(/RECEBEMOS DE\s+(.+?)\s+OS PRODUTOS/i);
  if (rcb) {
    supplier_name = rcb[1].replace(/\s+/g, ' ').trim();
  } else {
    const head = (text.split(/\bDANFE\b/)[0] || '').replace(/\s+/g, ' ');
    supplier_name = head.split(/\s+(?:AVENIDA|AV\.?|RUA|R\.|ROD\.?|RODOVIA|ESTRADA|TRAVESSA|PRA[CÇ]A|ALAMEDA)\b/i)[0].trim() || null;
  }
  if (!supplier_name) uncertain.push('supplier_name');

  // ── CNPJ: da chave (confiável); senão tenta um CNPJ formatado no texto ──
  let supplier_cnpj = fromKey ? fromKey.cnpj : null;
  if (!supplier_cnpj) {
    const m = text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    supplier_cnpj = m ? m[1].replace(/\D/g, '') : null;
    if (!supplier_cnpj) uncertain.push('supplier_cnpj');
  }

  // ── Número e série: da chave; senão por rótulo ──
  let invoice_number = fromKey ? fromKey.number : null;
  if (!invoice_number) {
    const m = text.match(/N[ºo°]\s*([\d.]+)/);
    invoice_number = m ? String(Number(m[1].replace(/\D/g, ''))) : null;
    if (!invoice_number) uncertain.push('invoice_number');
  }
  const series = fromKey
    ? fromKey.series
    : (text.match(/S[ÉE]RIE:?\s*(\d+)/i) || [])[1] || null;

  // ── Data de emissão (dd.mm.aaaa → ISO) ──
  let issue_date = null;
  const dM = text.match(/DATA DA EMISS[ÃA]O\s*\n?\s*(\d{2})\.(\d{2})\.(\d{4})/i)
          || text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (dM) issue_date = `${dM[3]}-${dM[2]}-${dM[1]}`;
  else uncertain.push('issue_date');

  // ── Total da nota ──
  let total_amount = null;
  const tM = text.match(/VALOR TOTAL DA NOTA\s*\n?\s*([\d.]+,\d{2})/i);
  if (tM) total_amount = brNum(tM[1]);
  else uncertain.push('total_amount');

  // ── Itens (matchAll no texto inteiro; cabeçalho/rodapé não casam a regex) ──
  const items = [];
  for (const m of text.matchAll(ITEM_RE)) {
    items.push({
      product_code: m[1],
      description: m[2].replace(/\s+/g, ' ').trim(),
      ncm: m[3],
      cfop: m[5],
      quantity: brNum(m[7]),
      unit: m[6],
      unit_price: brNum(m[8]),
      total_price: brNum(m[10]),
    });
  }

  // ── Validação soma × total → confiança ──
  if (items.length && total_amount != null) {
    const sum = round2(items.reduce((s, i) => s + (i.total_price || 0), 0));
    if (Math.abs(sum - round2(total_amount)) > 0.02) {
      warnings.push(`Soma dos itens (R$ ${sum}) difere do total da nota (R$ ${round2(total_amount)}). Confira os itens.`);
    }
  }
  if (!items.length) warnings.push('Nenhum item reconhecido na nota — confira manualmente.');

  // Chave válida + total achado + soma batendo (sem warnings) ⇒ alta confiança.
  const source_confidence = (fromKey && total_amount != null && warnings.length === 0) ? 'high' : 'medium';

  return {
    ok: true,
    source_confidence,
    header: {
      supplier_name, supplier_cnpj, invoice_number, series,
      issue_date, total_amount, payment_method: null, access_key,
    },
    items,
    uncertain_fields: uncertain,
    warnings,
  };
}

module.exports = { parseDanfeText, ITEM_RE };
