'use strict';

/**
 * Convert DD/MM/YYYY (Luna format) → YYYY-MM-DD (PostgreSQL)
 * Also accepts YYYY-MM-DD and passes it through.
 */
function toDB(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [d, m, y] = dateStr.split('/');
  if (!d || !m || !y) throw new Error(`Invalid date format: ${dateStr} (expected DD/MM/YYYY)`);
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Convert YYYY-MM-DD (PostgreSQL) → DD/MM/YYYY (Luna/display format)
 */
function fromDB(dateStr) {
  if (!dateStr) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Return all calendar dates [start, end) as YYYY-MM-DD strings.
 * Checkout date is excluded (standard pousada convention).
 */
function dateRange(checkinISO, checkoutISO) {
  const dates = [];
  const cur = new Date(checkinISO);
  const end = new Date(checkoutISO);
  while (cur < end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

module.exports = { toDB, fromDB, dateRange };
