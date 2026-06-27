'use strict';

/**
 * Parser canônico de NF-e/NFC-e (layout nacional SEFAZ) — Camada 1 das Compras.
 *
 * Recebe o TEXTO do XML e devolve a nota + itens já normalizados. Sem I/O: puro
 * e testável. O parsing do navegador (DOMParser, Camada 0) foi aposentado em
 * favor deste, para ter um único caminho de import com dedup consistente.
 *
 * Só mercadoria (NF-e/NFC-e). NFS-e (serviço) varia por município e NÃO é
 * suportada de propósito — cai no erro "não encontrei a chave da NF-e".
 */

const { XMLParser } = require('fast-xml-parser');
const { normalizeNfeKey } = require('./expense-helpers');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Mantém tudo como string: evita perder zeros de cProd/NCM e precisão de valores.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // Remove prefixos de namespace (ex.: <ns:infNFe> → infNFe), se houver.
  removeNSPrefix: true,
});

// ── Helpers de navegação tolerante ────────────────────────────────────────────
// O XML pode vir como <nfeProc><NFe><infNFe>… ou direto <NFe><infNFe>… Procura
// a primeira ocorrência de uma chave em qualquer profundidade.
function deepFind(node, key) {
  if (node === null || node === undefined || typeof node !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(node, key)) return node[key];
  for (const k of Object.keys(node)) {
    const found = deepFind(node[k], key);
    if (found !== undefined) return found;
  }
  return undefined;
}

// Texto de um campo simples (string direta ou objeto com #text).
function txt(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return v['#text'] !== undefined ? String(v['#text']).trim() : '';
  return String(v).trim();
}

// Garante array: o fast-xml-parser entrega 1 item como objeto, N como array.
function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// Número tolerante (vírgula ou ponto). Retorna null se não for número válido.
function num(v) {
  const s = txt(v).replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Só a data (YYYY-MM-DD) de um dhEmi (com fuso) ou dEmi (layout antigo).
function dateOnly(v) {
  const m = txt(v).match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

/**
 * parseNfe(xmlText) → { ok:true, invoice, items } | { ok:false, error }
 *
 * invoice: { nfe_key, supplier_name, supplier_cnpj, invoice_number,
 *            issue_date, total_amount }
 * items[]: { product_code, description, ncm, cfop, quantity, unit,
 *            unit_price, total_price }
 */
function parseNfe(xmlText) {
  if (!xmlText || typeof xmlText !== 'string' || xmlText.trim() === '') {
    return { ok: false, error: 'XML vazio.' };
  }

  let root;
  try {
    root = parser.parse(xmlText);
  } catch (_) {
    return { ok: false, error: 'Arquivo não é um XML válido.' };
  }

  const infNFe = deepFind(root, 'infNFe');
  if (!infNFe) {
    return { ok: false, error: 'Não encontrei a NF-e. Confira se é um XML de NF-e/NFC-e.' };
  }

  // Chave: atributo Id do infNFe ("NFe" + 44 díg.) ou tag <chNFe>.
  const rawKey = infNFe['@_Id'] || deepFind(root, 'chNFe');
  const nfe_key = normalizeNfeKey(rawKey);
  if (!nfe_key) {
    return { ok: false, error: 'Não encontrei a chave da NF-e (44 dígitos). Confira se é um XML de NF-e/NFC-e.' };
  }

  // Emitente (fornecedor).
  const emit = deepFind(infNFe, 'emit') || {};
  const supplier_name = txt(emit.xNome) || null;
  const supplier_cnpj = (txt(emit.CNPJ) || txt(emit.CPF)) || null;

  // Identificação da nota.
  const ide = deepFind(infNFe, 'ide') || {};
  const invoice_number = txt(ide.nNF) || null;
  const series = txt(ide.serie) || null;
  const issue_date = dateOnly(ide.dhEmi) || dateOnly(ide.dEmi);

  // Total: ICMSTot/vNF.
  const total = deepFind(infNFe, 'total') || {};
  const icmsTot = deepFind(total, 'ICMSTot') || {};
  const total_amount = num(icmsTot.vNF);
  if (!(total_amount > 0)) {
    return { ok: false, error: 'Não encontrei o valor total (vNF) na nota.' };
  }

  // Itens: loop <det>.
  const dets = asArray(infNFe.det);
  const items = dets.map((det) => {
    const prod = det && det.prod ? det.prod : {};
    return {
      product_code: txt(prod.cProd) || null,
      description:  txt(prod.xProd) || 'Item sem descrição',
      ncm:          txt(prod.NCM) || null,
      cfop:         txt(prod.CFOP) || null,
      quantity:     num(prod.qCom),
      unit:         txt(prod.uCom) || null,
      unit_price:   num(prod.vUnCom),
      total_price:  num(prod.vProd),
    };
  });

  return {
    ok: true,
    invoice: {
      nfe_key,
      supplier_name,
      supplier_cnpj,
      invoice_number,
      series,
      issue_date,
      total_amount: Math.round(total_amount * 100) / 100,
    },
    items,
  };
}

module.exports = { parseNfe };
