# CLAUDE-MINI.md — Contexto Rápido

> Versão compacta do CLAUDE.md para sessões sem /compact. Carregue este arquivo quando o contexto for limitado.

---

## Propósito do Sistema

> "Transformar leads de WhatsApp em reservas confirmadas."

**Métrica principal:** Taxa de conversão lead → reserva | **Meta: 10%**

---

## Stack

WhatsApp → Meta Cloud API → Vercel → Claude Haiku → Supabase + Google Sheets
**URL produção:** https://webhook-six-topaz.vercel.app
**Supabase:** https://nqxesjxbqupmhnivkfyk.supabase.co

---

## Prioridades (DEC-020 — vigência imediata)

| # | Feature | Status |
|---|---------|--------|
| 1 | Luna humanizada | Em execução |
| 2 | Fluxo [CONFIRMAR] → banco | Próximo |
| 3 | Cotação instantânea e precisa | Próximo |
| 4 | Proposta automática + link pagamento | Backlog |
| 5 | Calendário com disponibilidade real | Backlog |
| 6 | Confirmação automática pós-pagamento | Backlog |

**Adiado pós-Páscoa:** estoque, bar, mercearia

---

## Arquivos Críticos

| Arquivo | Função |
|---------|--------|
| `services/whatsapp/webhook.js` | Webhook WhatsApp — NÃO tocar sem CTO |
| `services/luna/system-prompt.js` | Identidade Luna — NÃO tocar sem CTO |
| `services/quotation/engine.js` | Motor de cotação |
| `services/supabase/client.js` | supabaseAdmin + supabasePublic |
| `server.js` | CRM Express — NÃO tocar sem CTO |
| `public/app.js` | Auth + cliente Supabase frontend |

---

## Sinais de Controle Luna

| Sinal | Ação |
|-------|------|
| `[ESCALAR: motivo]` | Notifica equipe |
| `[COTAR: tipo=, data_entrada=, data_saida=, pessoas=]` | Chama calculateQuotation() |
| `[CONFIRMAR: params]` | Persiste reserva no banco + notifica equipe |
| `[NOME: Nome]` | Salva no CRM |

---

## Regras CTO (imutáveis)

- **PROIBIDO sem aprovação:** `server.js`, `vercel.json`, `webhook.js`, `system-prompt.js`, `migrations/001-006`
- **SEGURO:** arquivos em `ai-os/`, novas migrations `007+`, novas routes, novos services

---

## Sidebar (DEC-020)

```
Dashboard
OPERAÇÃO:  Front Desk | Reservas | Calendário | Quartos
VENDAS:    Leads | Follow-ups | Propostas | Vouchers
RECEITA:   Financeiro | Relatórios | Pricing | Eventos da região
IA:        Command Center | Luna AI
```

---

## Fluxo de Decisão

Nenhum código sem DEC-XXX.md | Vitor aprova N1/N2 | CTO veta score < 40
Próximo DEC: **DEC-021**
