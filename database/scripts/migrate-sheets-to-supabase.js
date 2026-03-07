'use strict';

/**
 * Migration script: Google Sheets → Supabase
 * PLU-06.6 — Run once after Supabase schema is ready
 *
 * Usage:
 *   node database/scripts/migrate-sheets-to-supabase.js
 *
 * Requirements:
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 *   - GOOGLE_SHEETS_SPREADSHEET_ID + GOOGLE_SERVICE_ACCOUNT_* in .env
 */

require('dotenv').config();
const crypto = require('crypto');
const { google } = require('googleapis');
const { supabaseAdmin } = require('../../services/supabase/client');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function readSheet(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  return res.data.values || [];
}

function messageHash(whatsapp, timestamp, content) {
  return crypto.createHash('md5').update(`${whatsapp}|${timestamp}|${content}`).digest('hex');
}

function parseDate(str) {
  if (!str) return new Date().toISOString();
  // Try ISO first
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Try DD/MM/YYYY HH:MM:SS
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}:\d{2}:\d{2})?/);
  if (m) {
    const iso = `${m[3]}-${m[2]}-${m[1]}T${m[4] || '00:00:00'}-03:00`;
    const d2 = new Date(iso);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }
  return new Date().toISOString();
}

async function migrate() {
  if (!SPREADSHEET_ID) {
    console.error('GOOGLE_SHEETS_SPREADSHEET_ID not set in .env');
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL) {
    console.error('SUPABASE_URL not set in .env');
    process.exit(1);
  }

  const report = { leads_migrated: 0, conversations_migrated: 0, errors: [] };

  let sheets;
  try {
    sheets = await getSheetsClient();
  } catch (err) {
    console.error('Failed to authenticate Google Sheets:', err.message);
    process.exit(1);
  }

  // ── 1. Read Histórico sheet ───────────────────────────────────────────────
  console.log('Reading Histórico sheet...');
  let historico = [];
  try {
    const rows = await readSheet(sheets, 'Histórico');
    if (rows.length > 1) {
      historico = rows.slice(1).map(row => ({
        timestamp: row[0] || '',
        whatsapp:  row[1] || '',
        name:      row[2] || '',
        role:      row[3] || 'user',
        content:   row[4] || '',
      })).filter(r => r.whatsapp && r.content);
    }
    console.log(`  Found ${historico.length} messages`);
  } catch (err) {
    report.errors.push({ sheet: 'Histórico', error: err.message });
    console.warn('  Could not read Histórico:', err.message);
  }

  // ── 2. Extract unique phone numbers → upsert leads ────────────────────────
  console.log('Upserting leads...');
  const phoneNames = {};
  for (const row of historico) {
    if (row.whatsapp) {
      if (!phoneNames[row.whatsapp] && row.name) phoneNames[row.whatsapp] = row.name;
    }
  }

  // Also read Leads/Clientes sheets if they exist
  for (const sheetName of ['Leads', 'Clientes']) {
    try {
      const rows = await readSheet(sheets, sheetName);
      if (rows.length > 1) {
        for (const row of rows.slice(1)) {
          const phone = row[0], name = row[1];
          if (phone && !phoneNames[phone]) phoneNames[phone] = name || null;
        }
      }
    } catch {
      // Sheet doesn't exist — skip
    }
  }

  const leadIdMap = {};
  for (const [whatsapp, name] of Object.entries(phoneNames)) {
    try {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .upsert(
          { whatsapp_number: whatsapp, name, status: 'active' },
          { onConflict: 'whatsapp_number', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      if (error) throw error;
      leadIdMap[whatsapp] = data.id;
      report.leads_migrated++;
    } catch (err) {
      report.errors.push({ type: 'lead', whatsapp, error: err.message });
    }
  }
  console.log(`  Upserted ${report.leads_migrated} leads`);

  // ── 3. Insert conversations ───────────────────────────────────────────────
  console.log('Inserting conversations...');
  const BATCH_SIZE = 50;
  const conversationRows = [];

  for (const row of historico) {
    const leadId = leadIdMap[row.whatsapp];
    if (!leadId || !row.content) continue;

    const messageId = messageHash(row.whatsapp, row.timestamp, row.content);
    conversationRows.push({
      lead_id:    leadId,
      role:       ['user', 'assistant', 'system'].includes(row.role) ? row.role : 'user',
      content:    row.content,
      message_id: messageId,
      source:     'sheets_migration',
      created_at: parseDate(row.timestamp),
    });
  }

  // Batch upsert with ON CONFLICT DO NOTHING via message_id
  for (let i = 0; i < conversationRows.length; i += BATCH_SIZE) {
    const batch = conversationRows.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await supabaseAdmin
        .from('conversations')
        .upsert(batch, { onConflict: 'message_id', ignoreDuplicates: true });
      if (error) throw error;
      report.conversations_migrated += batch.length;
    } catch (err) {
      report.errors.push({ type: 'conversations_batch', batch_start: i, error: err.message });
    }
  }
  console.log(`  Inserted ${report.conversations_migrated} conversations`);

  // ── 4. Report ──────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────');
  console.log('Migration complete!');
  console.log(`  leads_migrated:        ${report.leads_migrated}`);
  console.log(`  conversations_migrated: ${report.conversations_migrated}`);
  console.log(`  errors:                ${report.errors.length}`);
  if (report.errors.length > 0) {
    console.log('\nErrors:');
    for (const e of report.errors) console.log(' ', JSON.stringify(e));
  }
  console.log('──────────────────────────────────────');

  return report;
}

migrate().catch(err => {
  console.error('Fatal migration error:', err.message);
  process.exit(1);
});
