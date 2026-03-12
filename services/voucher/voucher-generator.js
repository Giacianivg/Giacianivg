'use strict';

/**
 * Voucher PDF Generator — Pousada Luz da Lua
 * PLU-12.1 | DEC-016
 *
 * Gera vouchers PDF com identidade visual da pousada usando pdf-lib.
 * Geração on-demand em memória — sem storage externo.
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// ─── Cores da identidade visual ─────────────────────────────────────────────
const COLOR = {
  greenDark:  rgb(0.106, 0.263, 0.196),  // #1B4332
  greenMid:   rgb(0.145, 0.341, 0.259),  // #255842
  gold:       rgb(0.722, 0.525, 0.043),  // #B88600
  white:      rgb(1, 1, 1),
  textDark:   rgb(0.110, 0.110, 0.118),  // #1C1C1E
  textMuted:  rgb(0.431, 0.431, 0.431),  // #6E6E6E
  borderGray: rgb(0.878, 0.878, 0.878),  // #E0E0E0
  bgLight:    rgb(0.973, 0.973, 0.973),  // #F8F8F8
};

// ─── Labels por fonte ────────────────────────────────────────────────────────
const SOURCE_LABEL = {
  direct:   'Reserva Direta',
  booking:  'Reserva via Booking.com',
  expedia:  'Reserva via Expedia',
  whatsapp: 'Reserva via WhatsApp',
};

// ─── Labels de quarto ────────────────────────────────────────────────────────
const ROOM_LABEL = {
  ALA_A:        'Ala A — Standard Casal',
  ALA_B:        'Ala B — Família',
  ALA_C_CASAL:  'Ala C — Grupo (Casal)',
  ALA_C_GRUPO:  'Ala C — Grupo',
};

/**
 * Formata data Date/string para DD/MM/YYYY
 */
function fmtDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const day   = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year  = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Calcula número de noites entre check_in e check_out
 */
function calcNights(checkIn, checkOut) {
  try {
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  } catch {
    return 1;
  }
}

/**
 * Formata valor monetário em R$ XX.XXX,XX
 */
function fmtMoney(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

/**
 * Desenha um retângulo preenchido
 */
function fillRect(page, x, y, w, h, color) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

/**
 * Desenha uma linha horizontal
 */
function drawLine(page, x1, y, x2, color = COLOR.borderGray, thickness = 0.5) {
  page.drawLine({
    start: { x: x1, y },
    end:   { x: x2, y },
    thickness,
    color,
  });
}

/**
 * Gera o PDF de um voucher em memória.
 *
 * @param {Object} voucher
 * @param {string} voucher.id
 * @param {string} voucher.guest_name
 * @param {string} voucher.room_type
 * @param {string|Date} voucher.check_in
 * @param {string|Date} voucher.check_out
 * @param {number} voucher.guests
 * @param {string} voucher.source   - 'direct' | 'booking' | 'expedia' | 'whatsapp'
 * @param {number|null} voucher.total_amount
 * @param {string} voucher.status
 * @param {string} [voucher.notes]
 * @param {string|Date} voucher.created_at
 * @returns {Promise<Buffer>} — PDF como Buffer
 */
async function generateVoucherPDF(voucher) {
  const pdfDoc = await PDFDocument.create();

  // A4: 595 x 842 pts
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAD   = 48;  // margem lateral
  const INNER = width - PAD * 2;

  // ── HEADER ─────────────────────────────────────────────────────────────────
  const HEADER_H = 110;
  const headerY  = height - HEADER_H;

  fillRect(page, 0, headerY, width, HEADER_H, COLOR.greenDark);

  // Nome da pousada
  page.drawText('POUSADA LUZ DA LUA', {
    x: PAD,
    y: headerY + 68,
    size: 22,
    font: fontBold,
    color: COLOR.white,
  });

  // Tagline
  page.drawText('Socorro-SP  ·  Natureza e Aconchego', {
    x: PAD,
    y: headerY + 46,
    size: 10,
    font: fontRegular,
    color: rgb(0.8, 0.9, 0.85),
  });

  // Badge "VOUCHER" no canto direito
  fillRect(page, width - PAD - 90, headerY + 36, 90, 30, COLOR.gold);
  page.drawText('VOUCHER', {
    x: width - PAD - 75,
    y: headerY + 46,
    size: 11,
    font: fontBold,
    color: COLOR.white,
  });

  // Número do voucher (últimos 8 chars do UUID)
  const voucherNum = String(voucher.id || '').slice(-8).toUpperCase();
  page.drawText(`Nº ${voucherNum}`, {
    x: width - PAD - 80,
    y: headerY + 22,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.8, 0.9, 0.85),
  });

  // ── NOME DO HÓSPEDE ─────────────────────────────────────────────────────────
  let curY = headerY - 52;

  page.drawText('HÓSPEDE', {
    x: PAD,
    y: curY + 16,
    size: 8,
    font: fontBold,
    color: COLOR.textMuted,
  });

  page.drawText(voucher.guest_name || '—', {
    x: PAD,
    y: curY - 4,
    size: 22,
    font: fontBold,
    color: COLOR.textDark,
  });

  // ── SEPARADOR ──────────────────────────────────────────────────────────────
  curY -= 40;
  drawLine(page, PAD, curY, width - PAD, COLOR.borderGray, 1);

  // ── TABELA DE DETALHES ──────────────────────────────────────────────────────
  curY -= 32;

  const ROW_H  = 52;
  const COL_W  = INNER / 4;

  const details = [
    { label: 'ACOMODAÇÃO',  value: ROOM_LABEL[voucher.room_type] || voucher.room_type || '—' },
    { label: 'CHECK-IN',    value: fmtDate(voucher.check_in) },
    { label: 'CHECK-OUT',   value: fmtDate(voucher.check_out) },
    { label: 'HÓSPEDES',    value: String(voucher.guests ?? 1) },
  ];

  details.forEach((item, i) => {
    const colX = PAD + i * COL_W;

    // Fundo alternado levemente
    if (i % 2 === 0) {
      fillRect(page, colX, curY - 28, COL_W, ROW_H, COLOR.bgLight);
    }

    // Label
    page.drawText(item.label, {
      x: colX + 10,
      y: curY + 12,
      size: 8,
      font: fontBold,
      color: COLOR.textMuted,
    });

    // Valor
    page.drawText(item.value, {
      x: colX + 10,
      y: curY - 8,
      size: 13,
      font: fontBold,
      color: COLOR.textDark,
    });
  });

  // ── LINHA NOITES + VALOR ──────────────────────────────────────────────────
  curY -= ROW_H + 24;
  drawLine(page, PAD, curY + 24, width - PAD);

  const nights = calcNights(voucher.check_in, voucher.check_out);

  // Noites
  page.drawText('NOITES', {
    x: PAD,
    y: curY + 12,
    size: 8,
    font: fontBold,
    color: COLOR.textMuted,
  });
  page.drawText(String(nights), {
    x: PAD,
    y: curY - 8,
    size: 18,
    font: fontBold,
    color: COLOR.greenDark,
  });

  // Valor total
  if (voucher.total_amount != null) {
    const valStr = fmtMoney(voucher.total_amount);
    const valW   = fontBold.widthOfTextAtSize(valStr, 18);
    page.drawText('TOTAL DA ESTADIA', {
      x: width - PAD - valW,
      y: curY + 12,
      size: 8,
      font: fontBold,
      color: COLOR.textMuted,
    });
    page.drawText(valStr, {
      x: width - PAD - valW,
      y: curY - 8,
      size: 18,
      font: fontBold,
      color: COLOR.greenDark,
    });
  }

  // ── BADGE DE FONTE ────────────────────────────────────────────────────────
  curY -= 68;
  drawLine(page, PAD, curY + 24, width - PAD);

  const sourceText = SOURCE_LABEL[voucher.source] || voucher.source || 'Reserva Direta';
  const badgeW     = fontRegular.widthOfTextAtSize(sourceText, 10) + 24;

  fillRect(page, PAD, curY - 4, badgeW, 22, COLOR.greenDark);
  page.drawText(sourceText, {
    x: PAD + 12,
    y: curY + 4,
    size: 10,
    font: fontBold,
    color: COLOR.white,
  });

  // Status (se cancelado)
  if (voucher.status === 'cancelled') {
    fillRect(page, PAD + badgeW + 10, curY - 4, 90, 22, rgb(0.8, 0.2, 0.2));
    page.drawText('CANCELADO', {
      x: PAD + badgeW + 22,
      y: curY + 4,
      size: 10,
      font: fontBold,
      color: COLOR.white,
    });
  }

  // ── NOTES (opcional) ──────────────────────────────────────────────────────
  if (voucher.notes) {
    curY -= 50;
    drawLine(page, PAD, curY + 24, width - PAD);

    page.drawText('OBSERVAÇÕES', {
      x: PAD,
      y: curY + 10,
      size: 8,
      font: fontBold,
      color: COLOR.textMuted,
    });
    page.drawText(voucher.notes.slice(0, 100), {
      x: PAD,
      y: curY - 8,
      size: 10,
      font: fontRegular,
      color: COLOR.textDark,
    });
  }

  // ── RODAPÉ ────────────────────────────────────────────────────────────────
  const FOOTER_H = 60;
  fillRect(page, 0, 0, width, FOOTER_H, COLOR.greenDark);

  page.drawText('Obrigado por escolher a Pousada Luz da Lua!', {
    x: PAD,
    y: FOOTER_H - 20,
    size: 10,
    font: fontBold,
    color: COLOR.white,
  });

  const issuedAt = voucher.created_at ? fmtDate(voucher.created_at) : fmtDate(new Date());
  page.drawText(`Emitido em ${issuedAt}  ·  pousadaluzdaluasp.com.br  ·  (19) 99840-0306`, {
    x: PAD,
    y: FOOTER_H - 38,
    size: 8,
    font: fontRegular,
    color: rgb(0.7, 0.85, 0.78),
  });

  // ── RENDERIZAR ────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = { generateVoucherPDF, fmtDate, calcNights, fmtMoney, SOURCE_LABEL, ROOM_LABEL };
