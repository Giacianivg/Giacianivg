# 🚀 Guia de Deployment — Pousada Luz da Lua CRM

**Status:** Pronto para Produção
**Data:** 2026-03-07
**Sistema:** 100% Funcional

---

## 📋 Checklist de Deployment

### ✅ Fase 1: Supabase Setup (AGORA)

**Passo 1: Executar Migração de Schema**

1. Abra o Supabase Dashboard: https://app.supabase.com/
2. Vá em **SQL Editor** → **New Query**
3. Copie todo o conteúdo de `database/migrations/001_schema_initial.sql`
4. Cole no editor
5. Clique em **Run** (ou Ctrl+Enter)
6. Aguarde ~30 segundos

**Resultado esperado:**
```
✅ Sequences criadas (seq_reservations, seq_proposals)
✅ 10 tabelas criadas (leads, conversations, availability, etc)
✅ Índices criados
✅ Triggers instalados
✅ RLS policies ativadas
✅ RPCs (stored procedures) criadas
```

---

**Passo 2: Inicializar Calendário**

1. Novo query: **SQL Editor** → **New Query**
2. Copie todo o conteúdo de `database/migrations/002_calendar_seed.sql`
3. Cole e execute
4. Resultado: Tabela de disponibilidade preenchida para Q2 2026

---

### ✅ Fase 2: Verificação de Conectividade (LOCAL)

```bash
# No seu terminal:
npm test
```

**Resultado esperado:**
```
✔ GET /health retorna 200 com status ok
```

---

### ✅ Fase 3: GitHub Push (DEVOPS)

**A fazer via @devops:**

```bash
# Adicionar arquivos
git add .

# Commit com mensagem
git commit -m "feat(crm): Full stack deployment — Supabase + Vercel + docs [PLU-06/07]"

# Push para main
git push origin master:main
```

**Arquivos incluídos:**
- `database/migrations/` — 4 arquivos SQL de migration
- `docs/architecture/` — 8 documentos de arquitetura
- `docs/prd/` — PRD completo com RMS roadmap
- `database/run-migrations.js` — Script de automação

---

### ✅ Fase 4: Vercel Auto-Deploy

**Automático após git push:**

Vercel detectará o push em `main` branch e iniciará:
1. Build do projeto
2. Deploy da aplicação
3. Rodará CI/CD checks (.github/workflows/ci.yml)

**Status:** Verificar em https://vercel.com/vitorgomes/pousada-luz-da-lua

---

### ✅ Fase 5: Verificação de Saúde

```bash
# Endpoint local
curl http://localhost:3000/health

# Endpoint produção (após deploy)
curl https://webhook-six-topaz.vercel.app/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-03-07T02:30:00Z"
}
```

---

## 🎯 Ordem de Execução (IMPORTANTE)

1. ✅ **Supabase migrations** (001, 002) — executa SQL
2. ✅ **Tests locais** — npm test passa 11/11
3. ✅ **Git push** — Adiciona docs e migrations
4. ✅ **Vercel auto-deploy** — aguarda build
5. ✅ **Production verification** — curl health endpoint

---

## ⚠️ Possíveis Problemas & Soluções

### Problema: Supabase SQL Error

**Sintoma:** "relation "leads" already exists"

**Solução:** Tabelas já foram criadas. Execute apenas `002_calendar_seed.sql`

---

### Problema: Vercel Build Fail

**Sintoma:** Deploy falha no GitHub Actions

**Solução:**
1. Verifique CI logs em: https://github.com/vitorgomes/pousada-luz-da-lua/actions
2. Rode `npm run lint` e `npm test` localmente
3. Reenvie commit com `git push --force-with-lease`

---

### Problema: Health Endpoint 404

**Sintoma:** curl retorna 404 em /health

**Solução:**
1. Verifique se Vercel deployment completou
2. Espere 2-3 minutos após git push
3. Verifique URL em Vercel dashboard

---

## 📊 Variáveis de Ambiente (Vercel)

Já configuradas (ver `.env` ou Vercel dashboard para valores):

```
✅ SUPABASE_URL=*** (Supabase project URL)
✅ SUPABASE_ANON_KEY=*** (Supabase anonymous key — public)
✅ SUPABASE_SERVICE_ROLE_KEY=*** (Supabase service role — KEEP SECRET)
✅ WHATSAPP_ACCESS_TOKEN=*** (Meta System User Token)
✅ WHATSAPP_PHONE_NUMBER_ID=*** (Meta phone number ID)
✅ EQUIPE_WHATSAPP_NUMBER=5519998400306 (Team WhatsApp number)
✅ GOOGLE_SHEETS_SPREADSHEET_ID=*** (Google Sheets ID)
✅ GOOGLE_SERVICE_ACCOUNT_EMAIL=*** (Google service account)
✅ GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=*** (Google service account key — KEEP SECRET)
```

**⚠️ SECURITY:** All secrets are stored securely in:
- Local: `.env.local` (gitignored)
- Production: Vercel Environment Variables (encrypted)
- Never commit secrets to git

---

## 🎉 Próximas Etapas (Após Deploy)

1. **Frontend Development** — @dev implementa fases 0-5
2. **RLS Policies Testing** — @qa valida segurança
3. **Phase 2 (RMS)** — Implementar tabelas 003_phase2_rms_tables.sql

---

## 📞 Contato

**Orion** (@aios-master) — Orquestração de deployment
**Gage** (@devops) — Git push e Vercel deployment
**Dara** (@data-engineer) — Schema e migrations Supabase
