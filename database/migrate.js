#!/usr/bin/env node
/**
 * Simple Supabase Migration Executor
 * Lê arquivo SQL e executa via pg_net ou via node-postgres
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function executeMigration(migrationFile) {
  const sql = fs.readFileSync(migrationFile, 'utf8');
  const fileName = path.basename(migrationFile);

  console.log(`\n📝 Executando: ${fileName}`);
  console.log(`📊 Tamanho: ${(sql.length / 1024).toFixed(2)} KB`);

  // For demonstration - show first few statements
  const lines = sql.split('\n').slice(0, 30);
  console.log('\n--- Primeiras 30 linhas ---');
  lines.forEach((line, i) => {
    if (!line.startsWith('--')) {
      console.log(`  ${i+1}: ${line.substring(0, 80)}`);
    }
  });

  console.log('\n✅ Migração pronta para execução via Supabase Dashboard');
  console.log(`\n📋 Instruções de execução:`);
  console.log(`1. Abra: ${process.env.SUPABASE_URL}`);
  console.log(`2. Vá em: SQL Editor`);
  console.log(`3. Clique em: New Query`);
  console.log(`4. Cole todo o conteúdo de: database/migrations/${fileName}`);
  console.log(`5. Clique em: Run`);

  return true;
}

async function main() {
  const migrations = [
    'database/migrations/001_schema_initial.sql',
    'database/migrations/002_calendar_seed.sql'
  ];

  console.log('🚀 Verificador de Migrações Supabase');
  console.log(`📦 Supabase URL: ${process.env.SUPABASE_URL}`);

  for (const migFile of migrations) {
    const fullPath = path.join(process.cwd(), migFile);
    if (fs.existsSync(fullPath)) {
      await executeMigration(fullPath);
    } else {
      console.log(`⚠️  Arquivo não encontrado: ${migFile}`);
    }
  }
}

main().catch(console.error);
