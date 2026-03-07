'use strict';

/**
 * Parse currency string to float number.
 * Handles: "R$180,00", "R$ 180", "180.00", "180", "R$1.200,50"
 */
function parseCurrency(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  // Remove currency symbol and spaces
  let s = String(str).replace(/R\$\s*/g, '').trim();
  // Handle Brazilian format: 1.200,50 → 1200.50
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(s) || 0;
}

/**
 * Format number as Brazilian currency string.
 * 180.50 → "R$ 180,50"
 */
function formatCurrency(value) {
  return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

module.exports = { parseCurrency, formatCurrency };
