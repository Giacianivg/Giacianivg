'use strict';

/**
 * Setup Google Sheets — cria as abas e cabeçalhos necessários.
 * Uso: node setup-sheets.js
 * Requer: GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY no .env
 */

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

async function setup() {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    console.error('❌ Configure GOOGLE_SHEETS_SPREADSHEET_ID e GOOGLE_SERVICE_ACCOUNT_EMAIL no .env');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Lê abas existentes
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = meta.data.sheets.map(s => s.properties.title);
  console.log('Abas existentes:', existingSheets);

  const TABS = [
    {
      title: 'Histórico',
      headers: ['Timestamp', 'Telefone', 'Nome', 'Role', 'Mensagem'],
    },
    {
      title: 'Leads',
      headers: ['Timestamp', 'Telefone', 'Nome', 'Evento', 'Dados', 'Status'],
    },
    {
      title: 'Clientes',
      headers: ['Telefone', 'Nome', 'Primeira_Conversa', 'Ultima_Conversa'],
    },
  ];

  const requests = [];

  for (const tab of TABS) {
    if (!existingSheets.includes(tab.title)) {
      requests.push({
        addSheet: { properties: { title: tab.title } },
      });
      console.log(`  + Criando aba: ${tab.title}`);
    } else {
      console.log(`  ✓ Aba já existe: ${tab.title}`);
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    });
  }

  // Adiciona cabeçalhos nas abas (linha 1 se vazia)
  for (const tab of TABS) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tab.title}!A1:Z1`,
    });
    const firstRow = res.data.values?.[0];
    if (!firstRow || firstRow.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab.title}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [tab.headers] },
      });
      console.log(`  ✓ Cabeçalhos adicionados em: ${tab.title}`);
    } else {
      console.log(`  ✓ Cabeçalhos já existem em: ${tab.title}`);
    }
  }

  console.log('\n✅ Google Sheets configurado com sucesso!');
  console.log(`   Planilha: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);
}

setup().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
