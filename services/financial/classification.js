'use strict';

/**
 * Classificação de itens de compra (Compras — Camada 1) e cálculo do valor que
 * vai pro negócio. Puro e determinístico — sem I/O, sem IA. Testável isolado.
 *
 * As 4 classes e a regra do business_amount são a regra de negócio central; o
 * banco (recalc_invoice_business, migration 044) espelha exatamente este cálculo
 * — esta versão JS serve ao preview ao vivo e aos testes.
 */

// Ordem = ordem de exibição na tela. 'pousada_estoque' é o padrão.
const ITEM_CLASSES = ['pousada_estoque', 'pousada_nao_estoque', 'ativo_imobilizado', 'particular'];
const DEFAULT_ITEM_CLASS = 'pousada_estoque';

// Rótulos para a UI (espelhados no front).
const ITEM_CLASS_LABELS = {
  pousada_estoque:     'Estoque da pousada',
  pousada_nao_estoque: 'Despesa (não-estoque)',
  ativo_imobilizado:   'Ativo imobilizado',
  particular:          'Particular / pessoal',
};

function isValidClass(c) {
  return ITEM_CLASSES.includes(c);
}

// Classe segura: inválida/ausente cai no padrão.
function coerceClass(c) {
  return isValidClass(c) ? c : DEFAULT_ITEM_CLASS;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Normaliza a descrição p/ a memória de classificação: minúsculo, sem acento,
// espaços colapsados. É a chave de casamento "aprende a classe deste produto".
function normalizeDesc(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * computeBusinessAmount(totalAmount, items) — Opção B (aprovada pelo Founder):
 *   business = vNF − Σ(total_price dos itens 'particular'), com piso 0.
 *   Se NENHUM item é da pousada (todos particulares) → 0 (frete pessoal também).
 *
 * items: [{ item_class, total_price }]
 */
function computeBusinessAmount(totalAmount, items) {
  const vNF = round2(totalAmount);
  const list = Array.isArray(items) ? items : [];

  const nonParticular = list.filter((i) => coerceClass(i.item_class) !== 'particular');
  if (nonParticular.length === 0) return 0;

  const particularSum = list
    .filter((i) => coerceClass(i.item_class) === 'particular')
    .reduce((s, i) => s + (Number(i.total_price) || 0), 0);

  return Math.max(0, round2(vNF - round2(particularSum)));
}

module.exports = {
  ITEM_CLASSES,
  DEFAULT_ITEM_CLASS,
  ITEM_CLASS_LABELS,
  isValidClass,
  coerceClass,
  normalizeDesc,
  computeBusinessAmount,
};
