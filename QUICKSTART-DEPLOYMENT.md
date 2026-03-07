# ⚡ Quickstart: Deployment em 5 Minutos

**TL;DR:** Execute os 4 passos abaixo e o sistema estará 100% funcional.

---

## 1️⃣ Supabase: Executar Migrations (2 min)

### a) Primeira Migration (Schema)

```bash
# Copie TUDO de database/migrations/001_schema_initial.sql
# Vá em: https://app.supabase.com/ → SQL Editor → New Query
# Cole e execute com Ctrl+Enter
```

**O que acontece:**
- ✅ 10 tabelas criadas
- ✅ Índices otimizados
- ✅ Triggers de auditoria
- ✅ RLS policies ativadas
- ✅ Stored procedures para números

---

### b) Segunda Migration (Calendário)

```bash
# Copie TUDO de database/migrations/002_calendar_seed.sql
# Mesmo lugar: SQL Editor → New Query
# Cole e execute
```

**O que acontece:**
- ✅ Tabela `availability` preenchida com Q2 2026

---

## 2️⃣ Local: Rodar Testes (1 min)

```bash
cd /c/PROJETOS/POUSADA/meu-projeto

npm test
# Resultado esperado: ✔ 11 tests passed
```

Se todos os testes passaram → ✅ Sistema pronto

---

## 3️⃣ Git: Push para Main (1 min)

```bash
# Adicionar arquivos
git add .

# Commit
git commit -m "feat(crm): Full stack deployment — Supabase + Vercel + docs [PLU-06/07]"

# Push (APENAS @devops pode fazer isso)
git push origin master:main
```

---

## 4️⃣ Vercel: Aguardar Deploy (auto, 1 min)

```bash
# Verificar status
curl https://webhook-six-topaz.vercel.app/health

# Resposta esperada:
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-03-07T..."
}
```

---

## ✅ Pronto!

Sistema está 100% funcional em produção.

### Próximas tarefas:
- Frontend CRM (Next.js, @dev)
- QA das RLS policies (@qa)
- Phase 2 RMS (dynamic pricing, @architect)

---

## 🆘 Se der erro...

| Erro | Solução |
|------|---------|
| "relation already exists" | Pule para migration 002 |
| npm test falha | Rodar `npm install` primeiro |
| Build falha no Vercel | Verifique branch: `main` (não `master`) |
| Health endpoint 404 | Espere 2min após deploy |

---

**Orquestração:** @aios-master
**DevOps:** @devops (git push)
**Database:** @data-engineer (schema review)
