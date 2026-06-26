'use strict';

/**
 * Sugere uma categoria de despesa a partir dos itens da NF-e, por palavra-chave.
 * Puro e determinístico (sem IA) — o usuário sempre pode trocar na importação.
 *
 * A correspondência é feita entre as descrições dos produtos (xProd) e um mapa
 * de palavras-chave → nome de categoria. O nome casado é então resolvido contra
 * as categorias reais do banco (case/acento-insensível) para devolver o id.
 */

// Remove acentos e baixa a caixa — comparação robusta a "Café"/"cafe".
function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Palavra-chave → nome canônico da categoria (seed da migration 042).
// Ordem importa pouco: contamos hits e pegamos o vencedor.
const KEYWORD_MAP = [
  { cat: 'Café da manhã', words: ['cafe', 'pao', 'leite', 'manteiga', 'queijo', 'presunto', 'ovo', 'fruta', 'suco', 'iogurte', 'bolo', 'biscoito', 'cereal', 'geleia', 'acucar', 'achocolatado'] },
  { cat: 'Limpeza',       words: ['detergente', 'sabao', 'desinfetante', 'agua sanitaria', 'cloro', 'alvejante', 'esponja', 'vassoura', 'rodo', 'pano', 'papel higienico', 'papel toalha', 'amaciante', 'limpa', 'multiuso', 'luva'] },
  { cat: 'Manutenção',    words: ['parafuso', 'tinta', 'lampada', 'cano', 'torneira', 'ferramenta', 'cimento', 'eletrico', 'hidraulic', 'reparo', 'broca', 'fita', 'silicone', 'cola', 'prego', 'chuveiro', 'registro'] },
  { cat: 'Jardinagem',    words: ['planta', 'adubo', 'terra', 'semente', 'muda', 'jardim', 'grama', 'fertilizante', 'vaso', 'poda'] },
  { cat: 'Lavanderia',    words: ['sabao em po', 'amaciante', 'lavanderia', 'roupa de cama', 'toalha', 'lencol', 'fronha', 'edredom'] },
  { cat: 'Contas (água/luz/gás/internet)', words: ['energia', 'eletrica', 'agua', 'gas', 'internet', 'telefone', 'conta de luz', 'botijao'] },
];

/**
 * suggestCategory(items, categories) → { category_id, category_name, matched }
 *   items:      [{ description, ... }]   (saída do parseNfe)
 *   categories: [{ id, name, ... }]      (expense_categories do banco)
 *
 * Conta palavras-chave casadas nas descrições; a categoria com mais hits vence.
 * Sem hits → primeira categoria "Outros" (se existir), senão null.
 */
function suggestCategory(items = [], categories = []) {
  const empty = { category_id: null, category_name: null, matched: false };
  if (!Array.isArray(categories) || categories.length === 0) return empty;

  // Resolve nome canônico → categoria real do banco (acento/caixa-insensível).
  const byNorm = new Map();
  for (const c of categories) byNorm.set(normalize(c.name), c);

  const blob = items.map((i) => normalize(i && i.description)).join('  ');

  let best = null;
  let bestHits = 0;
  for (const entry of KEYWORD_MAP) {
    const cat = byNorm.get(normalize(entry.cat));
    if (!cat) continue; // categoria foi removida/renomeada no banco — ignora
    let hits = 0;
    for (const w of entry.words) {
      if (blob.includes(normalize(w))) hits += 1;
    }
    if (hits > bestHits) { bestHits = hits; best = cat; }
  }

  if (best) {
    return { category_id: best.id, category_name: best.name, matched: true };
  }

  // Fallback: "Outros", se existir.
  const outros = byNorm.get('outros');
  if (outros) return { category_id: outros.id, category_name: outros.name, matched: false };
  return empty;
}

module.exports = { suggestCategory, KEYWORD_MAP };
