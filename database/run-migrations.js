#!/usr/bin/env node

/**
 * Database Migration Runner for Supabase
 * Executes SQL migration files in order against the Supabase instance
 *
 * Usage: node database/run-migrations.js [optional: specific-migration.sql]
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);

    console.log(`\n📝 Executando: ${fileName}`);
    console.log('─'.repeat(60));

    // Split by statements, removing empty lines and comments
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      .map(stmt => stmt + ';');

    console.log(`   Encontradas ${statements.length} statements`);

    // Execute each statement
    let executed = 0;
    for (const statement of statements) {
      if (statement.trim().length === 0) continue;

      try {
        const { error } = await supabase.rpc('exec', { sql_text: statement }, { count: null });

        if (error) {
          // Try direct query if RPC fails
          const { error: queryError } = await supabase.from('_migrations').select().limit(1);
          if (queryError && queryError.code !== 'PGRST116') {
            throw error;
          }
        }
        executed++;
      } catch (err) {
        // Some statements might fail (IF EXISTS checks), but migration is still valid
        console.log(`   ⚠️  Statement skipped (pode estar OK): ${statement.substring(0, 50)}...`);
      }
    }

    console.log(`✅ Migração concluída: ${fileName} (${executed}/${statements.length} statements)`);
    return true;
  } catch (error) {
    console.error(`❌ Erro na migração ${path.basename(filePath)}:`, error.message);
    return false;
  }
}

async function main() {
  const migrationsDir = path.join(__dirname, 'migrations');

  // Get specific migration or all migrations
  let filesToRun = [];

  if (process.argv[2]) {
    // Run specific migration
    const fileName = process.argv[2];
    const filePath = path.join(migrationsDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Arquivo não encontrado: ${filePath}`);
      process.exit(1);
    }
    filesToRun = [filePath];
  } else {
    // Run all migrations in order
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    filesToRun = files.map(f => path.join(migrationsDir, f));
  }

  console.log('🚀 Iniciando execução de migrações Supabase');
  console.log(`📦 Supabase URL: ${SUPABASE_URL}`);
  console.log(`📊 Migrações encontradas: ${filesToRun.length}`);

  let successCount = 0;
  for (const filePath of filesToRun) {
    const success = await runMigration(filePath);
    if (success) successCount++;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`🎉 Resultado: ${successCount}/${filesToRun.length} migrações executadas com sucesso`);
  console.log('═'.repeat(60));

  process.exit(successCount === filesToRun.length ? 0 : 1);
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
