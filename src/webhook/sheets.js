'use strict';

/**
 * Google Sheets — histórico de conversa + registro de leads + perfil do cliente
 * Abas necessárias no spreadsheet:
 *   "Histórico"  → A:Timestamp | B:Telefone | C:Nome | D:Role | E:Mensagem
 *   "Leads"      → A:Timestamp | B:Telefone | C:Nome | D:Evento | E:Dados | F:Status
 *   "Clientes"   → A:Telefone | B:Nome | C:Primeira_Conversa | D:Ultima_Conversa
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

/**
 * Retorna o perfil do cliente pela aba "Clientes".
 * @returns {{ nome: string|null, isNew: boolean }}
 */
async function getClientProfile(phone) {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    return { nome: null, isNew: true };
  }
  try {
    const sheets = await getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Clientes!A:D',
    });
    const rows = res.data.values || [];
    const row = rows.find(r => r[0] === phone);
    if (!row) return { nome: null, isNew: true };
    return { nome: row[1] || null, isNew: false };
  } catch (err) {
    console.error('[sheets] Erro ao ler perfil cliente:', err.message);
    return { nome: null, isNew: true };
  }
}

/**
 * Cria ou atualiza o perfil do cliente na aba "Clientes".
 */
async function upsertClient(phone, nome) {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return;
  try {
    const sheets = await getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Clientes!A:D',
    });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(r => r[0] === phone);
    const ts = new Date().toISOString();

    if (rowIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Clientes!A:D',
        valueInputOption: 'RAW',
        requestBody: { values: [[phone, nome, ts, ts]] },
      });
    } else {
      const sheetRow = rowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Clientes!B${sheetRow}:D${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[nome, rows[rowIndex][2] || ts, ts]] },
      });
    }
  } catch (err) {
    console.error('[sheets] Erro ao salvar perfil cliente:', err.message);
  }
}

module.exports = { getConversationHistory, appendMessage, recordEvent, getClientProfile, upsertClient };
