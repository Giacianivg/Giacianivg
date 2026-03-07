# PLU-06.6: Migração de Dados Históricos (Google Sheets → Supabase)

**Status:** Draft
**Epic:** EPIC-PLU-06 — Fundação CRM
**Points:** 3
**Priority:** Media
**Executor:** @dev
**Quality Gate:** @qa
**Depends on:** PLU-06.1

---

## User Story

**Como** gestor da pousada,
**quero** ter o histórico de conversas e leads existentes no Google Sheets migrado para o Supabase,
**para** que o CRM comece com dados reais e Luna tenha contexto histórico de hóspedes recorrentes.

---

## Acceptance Criteria

- [ ] AC-01: Script `database/scripts/migrate-sheets-to-supabase.js` lê as abas Histórico, Leads e Clientes do Google Sheets
- [ ] AC-02: Cada linha da aba Histórico inserida na tabela `conversations` com `source = 'sheets_migration'`
- [ ] AC-03: Cada número de WhatsApp único (aba Leads/Histórico) upserted na tabela `leads` com dados disponíveis
- [ ] AC-04: Script é idempotente — reexecutar não duplica registros (usa `ON CONFLICT DO NOTHING` onde aplicável)
- [ ] AC-05: Script gera relatório final: `{ leads_migrated, conversations_migrated, errors: [] }`
- [ ] AC-06: Linhas com erro são logadas mas não interrompem a migração (continua próxima linha)

---

## Technical Notes

### Google Sheets → Supabase Mapping

| Sheets (Histórico) | Supabase `conversations` |
|--------------------|--------------------------|
| Timestamp          | `created_at`             |
| Telefone           | via `lead_id` lookup     |
| Nome               | via `lead_id`            |
| Role               | `role` ('user'/'assistant') |
| Mensagem           | `content`                |

| Sheets (Leads/Clientes) | Supabase `leads`    |
|-------------------------|---------------------|
| Telefone                | `whatsapp_number`   |
| Nome                    | `name`              |
| — (infer)               | `status = 'active'` |

### Script Structure
```javascript
// database/scripts/migrate-sheets-to-supabase.js
// 1. Authenticate Google Sheets (same service account)
// 2. Read Histórico sheet (all rows)
// 3. Extract unique phone numbers → upsert leads
// 4. Insert conversations with lead_id references
// 5. Print migration report
```

### Idempotency
- `leads`: upsert on `whatsapp_number` (unique constraint)
- `conversations`: `message_id` = hash of (whatsapp + timestamp + content) + `ON CONFLICT DO NOTHING`

---

## Tasks

- [ ] T1: `database/scripts/migrate-sheets-to-supabase.js` — lê Sheets, upsert leads
- [ ] T2: Inserir conversações com `source = 'sheets_migration'` e deduplicação por hash
- [ ] T3: Relatório final com contadores e lista de erros
- [ ] T4: Testar em ambiente de desenvolvimento com planilha real

---

## Quality Gate — @qa

- [ ] QG-01: Script não expõe credenciais no output/logs
- [ ] QG-02: Idempotência verificada: executar 2x produz mesmo resultado
- [ ] QG-03: Erros por linha não interrompem script — todos logados ao final

---

## File List

- `database/scripts/migrate-sheets-to-supabase.js` — novo

---

## Dev Agent Record

**Agent Model Used:** —
**Debug Log:** —
**Completion Notes:** —

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Story criada | River (@sm) |
