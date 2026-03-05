# EPIC-PLU-01: Funil de Vendas Automatizado

**Status:** 📋 Planning
**Owner:** Morgan (@pm)
**Created:** 2026-02-22
**Prioridade:** 🔴 CRÍTICA — Impacto direto na conversão de reservas

---

## Objective

Construir um funil de vendas automatizado via WhatsApp Business API + Claude que receba leads, qualifique interesse, envie cotações personalizadas e feche reservas com mínima intervenção humana — aumentando a taxa de conversão lead→reserva de ~10% para >25%.

## Business Value

- **Impacto estimado:** +R$20-25k/mês em reservas convertidas automaticamente
- **Redução de carga operacional:** 70% das consultas respondidas por IA
- **Cobertura 24/7:** Atendimento fora do horário comercial captura leads que hoje são perdidos
- **Diferencial:** Tom humanizado do Claude mantém experiência premium da pousada

---

## Stakeholders

- Dono/Gestor da Pousada Luz da Lua
- Equipe de atendimento (WhatsApp atual)
- @architect (decisões de integração)
- @dev (implementação)

---

## Scope

### In Scope
- Migração do número (19) 99840-0306 de WhatsApp Business App para WhatsApp Business API (Meta)
- Integração WhatsApp Business API + Make.com como orquestrador
- Chatbot Claude Sonnet 4.6 para qualificação, cotação e fechamento
- Templates de mensagem aprovados pela Meta (boas-vindas, cotação, confirmação)
- Fluxo de escalonamento para atendimento humano com SLA por horário (12h-22h)
- Registro de leads e conversas no CRM (Airtable) com upsert por telefone
- Validação de segurança do webhook (X-Hub-Signature-256)
- Idempotência de mensagens (deduplicação por message_id)
- Configuração segura de secrets em produção (Vercel + Make.com)
- Otimização de precificação para períodos mistos (única chamada Airtable)

### Out of Scope
- App mobile próprio
- Chatbot para outros canais (Instagram DM, email) — fase 2
- Pagamento online integrado ao WhatsApp — fase 2
- IA treinada com dados históricos próprios — fase 2

---

## Stories

| ID | Title | Points | Priority | Status | Executor | Quality Gate |
|----|-------|--------|----------|--------|----------|-------------|
| PLU-01.1 | Migração WhatsApp App → Business API | 5 | Alta | InProgress | @devops | @architect |
| PLU-01.2 | Integração Claude + Make.com (chatbot base) | 8 | Alta | InProgress | @dev | @architect |
| PLU-01.3 | Fluxo completo: qualificação → cotação → fechamento | 8 | Alta | InProgress | @dev | @architect |
| PLU-01.4 | Configuração de Produção e Otimização de Desempenho | 3 | Alta | Draft | @dev | @architect |

**Total Points:** 24

> **PLU-01.4 adicionada em 2026-02-24** — surfaçada pelo Brownfield Discovery (DT-08: secrets de produção; DB-11: otimização de precificação por período). Pré-requisito para divulgação pública do número.

---

## Success Criteria

- [ ] Número (19) 99840-0306 operando via WhatsApp Business API sem downtime
- [ ] Claude responde consultas em <2 minutos automaticamente
- [ ] Taxa de conversão lead→cotação: >60%
- [ ] Taxa de conversão cotação→reserva: >25%
- [ ] Escalonamento humano funcional para casos complexos
- [ ] Histórico de conversas registrado no Airtable

---

## Technical Requirements

- WhatsApp Business API (Meta) — conta verificada de negócio necessária
- Anthropic API (Claude Sonnet 4.6) — chave de API configurada
- Make.com ou n8n — orquestrador de webhook
- Airtable — banco de dados de leads e conversas
- Webhook HTTPS público (Vercel/Railway) para receber mensagens da Meta

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Downtime durante migração do número | Alto | Migrar em horário de menor movimento; manter backup no app durante transição |
| Meta rejeitar templates de mensagem | Médio | Seguir guidelines rigorosas da Meta; ter 2-3 variações por template |
| Claude gerar resposta inadequada | Médio | System prompt robusto + exemplos; escalonamento automático em casos de baixa confiança |
| Custo de API acima do previsto | Baixo | Monitorar tokens por conversa; DeepSeek para FAQs simples (economia ~55%) |
| Mensagens duplicadas (Meta retry) | Médio | Idempotência por message_id implementada em PLU-01.3 T5.5 |
| Webhook injetado por terceiros | Alto | Validação X-Hub-Signature-256 implementada em PLU-01.1 T7 |
| Overbooking por race condition | Médio | Make.com concurrency=1 (processamento sequencial) — risco <0.1% no volume MVP |

---

## Dependencies

**Depends on:**
- Conta Meta Business verificada (CNPJ da pousada)
- Número de telefone disponível para migração
- Chave API Anthropic ativa

**Blocks:**
- EPIC-PLU-04 (CRM/Retenção) — depende do registro de leads deste épico

---

## Documentation

| Type | Location | Status |
|------|----------|--------|
| Project Brief | docs/brief.md | ✅ Done |
| Arquitetura de integração | docs/architecture/whatsapp-claude-arch.md | Pending |
| System Prompt Claude | docs/architecture/claude-system-prompt.md | ✅ Done (v1.3 — com FAQs, horários, SLA) |
| Schema Airtable | docs/data/SCHEMA.md | ✅ Done (v1.1 — 4 tabelas) |
| Diagnóstico técnico | docs/prd/technical-debt-assessment.md | ✅ Done (Brownfield Discovery completo) |
| Relatório executivo | docs/reports/TECHNICAL-DEBT-REPORT.md | ✅ Done |
| Inventário de secrets | docs/architecture/secrets-inventory.md | Pending (PLU-01.4 T1.6) |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-22 | 1.0 | Epic criado via *create-epic | Morgan (@pm) |
| 2026-02-24 | 2.0 | Brownfield Discovery concluído — adicionada PLU-01.4; stories PLU-01.1/01.2/01.3 expandidas com debts QA-01, QA-02, UX-01, UX-02, UX-04, UX-05, DB-02, DB-11, DB-12; riscos e documentação atualizados | Aria (@architect) / Morgan (@pm) |
