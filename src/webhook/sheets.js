'use strict';

/**
 * Google Sheets — histórico de conversa + registro de leads
 * Sheets necessárias no spreadsheet:
 *   "Histórico"  → colunas: Timestamp | Telefone | Nome | Role | Mensagem
 *   "Leads"      → colunas: Timestamp | Telefone | Nome | Evento | Dados | Status
 */

const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const MAX_HISTORY = 20;

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

let _sheets = null;
async function getSheets() {
  if (!_sheets) {
    const auth = getAuth();
    _sheets = google.sheets({ version: 'v4', auth });
  }
  return _sheets;
}

/**
 * Retorna histórico formatado para a API Anthropic [{role, content}]
 * Lê as últimas MAX_HISTORY mensagens do contato na aba "Histórico".
 */
async function getConversationHistory(phone) {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return [];

  try {
    const sheets = await getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Histórico!A:E',
    });

    const rows = res.data.values || [];
    // col B (index 1) = Telefone, col D (index 3) = Role, col E (index 4) = Mensagem
    const phoneRows = rows.filter(r => r[1] === phone && r[3] && r[4]);
    const recent = phoneRows.slice(-MAX_HISTORY);
    return recent.map(r => ({ role: r[3], content: r[4] }));
  } catch (err) {
    console.error('[sheets] Erro ao ler histórico:', err.message);
    return [];
  }
}

/**
 * Grava uma mensagem (user ou assistant) no histórico.
 */
async function appendMessage(phone, contactName, role, content) {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return;

  try {
    const sheets = await getSheets();
    const ts = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Histórico!A:E',
      valueInputOption: 'RAW',
      requestBody: { values: [[ts, phone, contactName, role, content]] },
    });
  } catch (err) {
    console.error('[sheets] Erro ao gravar histórico:', err.message);
  }
}

/**
 * Registra um evento de lead (ESCALAR, CONFIRMAR, COTAR) na aba "Leads".
 */
async function recordEvent(phone, contactName, evento, dados) {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return;

  try {
    const sheets = await getSheets();
    const ts = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Leads!A:F',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[ts, phone, contactName, evento, JSON.stringify(dados), 'Novo']],
      },
    });
  } catch (err) {
    console.error('[sheets] Erro ao gravar evento:', err.message);
  }
}

module.exports = { getConversationHistory, appendMessage, recordEvent };
