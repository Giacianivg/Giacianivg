# EPIC-PLU-07: Luna <-> CRM e Automacoes de Follow-up

**Status:** Planning
**Owner:** Morgan (@pm)
**Created:** 2026-03-06
**Prioridade:** Alta — Converte leads em reservas automaticamente

---

## Objective

Integrar o chatbot Luna (WhatsApp) com o CRM (Supabase) para persistir leads, executar o fluxo completo lead -> qualificacao -> proposta -> reserva -> sinal, e automatizar follow-ups para leads que nao reservaram. Esta epic transforma o WhatsApp em maquina de reservas 24/7.

## Business Value

- **Impacto estimado:** +R$20-25k/mes (taxa de conversao lead->reserva de 10% para 25%+)
- **Automacao de follow-up:** Recupera 15-20% dos leads que nao responderam proposta
- **Operacao 24/7:** Fecha reservas fora do horario comercial sem intervencao humana
- **Menos trabalho manual:** Equipe foca em hospedar, nao em responder mensagens

---

## Stakeholders

- Equipe de atendimento da pousada
- @dev (integracao Luna <-> Supabase + fluxo de reserva)
- @architect (design do fluxo de dados WhatsApp -> CRM)

---

## Scope

### In Scope
- Webhook Luna grava lead + conversa no Supabase (substitui Google Sheets)
- Luna consulta disponibilidade em tempo real via API do CRM
- Fluxo completo: lead -> qualificacao -> proposta -> confirmacao -> [CONFIRMAR] -> reserva criada no CRM
- Cobranca automatica do sinal 30% via MercadoPago PIX
- Automacao de follow-ups via n8n:
  - D+2: lead nao respondeu proposta
  - D+7: proposta vencida — renovar?
  - D+30: reativacao de lead frio
- Lembretes automaticos pos-confirmacao:
  - Lembrete de check-in (D-1)
  - Cobranca de saldo pendente (7 dias antes do check-in)
  - Pesquisa de satisfacao pos check-out (D+1)

### Out of Scope
- Email marketing (fase 2)
- Integracao com OTAs (fase 2)
- App mobile (fase 2)
- Programa de fidelidade (EPIC-PLU-04)

---

## Stories

| ID | Title | Points | Priority | Status | Executor | Quality Gate |
|----|-------|--------|----------|--------|----------|-------------|
| PLU-07.1 | Luna -> Supabase: persistencia de leads e conversas | 5 | Critica | Draft | @dev | @architect |
| PLU-07.2 | Luna consulta disponibilidade via API CRM | 3 | Critica | Draft | @dev | @architect |
| PLU-07.3 | Fluxo [CONFIRMAR]: cria reserva + envia link PIX sinal | 8 | Critica | Draft | @dev | @qa |
| PLU-07.4 | Setup n8n: automacao follow-up proposta (D+2, D+7) | 5 | Alta | Draft | @dev | @architect |
| PLU-07.5 | Reativacao automatica de leads frios (D+30) | 3 | Alta | Draft | @dev | @qa |
| PLU-07.6 | Lembretes automaticos: check-in, saldo, satisfacao | 5 | Media | Draft | @dev | @qa |

**Total Points:** 29

---

## Success Criteria

- [ ] 100% das conversas do WhatsApp gravadas no Supabase (substituindo Google Sheets)
- [ ] Luna consultando disponibilidade real antes de cotar
- [ ] [CONFIRMAR] criando reserva no CRM e enviando PIX automaticamente
- [ ] Sinal pago: reserva muda para status=confirmada, disponibilidade bloqueada
- [ ] Follow-up D+2 enviado automaticamente para propostas sem resposta
- [ ] Taxa de recuperacao de leads com proposta enviada: > 15%
- [ ] Lembrete de check-in enviado para 100% das reservas confirmadas

---

## Technical Requirements

- EPIC-PLU-06 concluida (Supabase + API CRM operacional)
- EPIC-PLU-01 concluida (WhatsApp API + webhook Vercel)
- n8n Cloud ou self-hosted (automacoes cron)
- MercadoPago PIX (webhook de confirmacao de pagamento)
- Claude Haiku (modelo atual da Luna — manter)

---

## Integration Flow

```
Hospede (WhatsApp)
  -> Meta Cloud API
  -> Vercel webhook (handler.js)
  -> Claude Haiku (Luna) — system prompt atualizado
  -> [sinal de controle detectado]
     -> [COTAR] -> consulta /api/disponibilidade -> resposta ao hospede
     -> [CONFIRMAR] -> POST /api/reservas -> gera PIX -> WhatsApp
     -> [ESCALAR] -> notifica equipe (ja implementado)
  -> POST /api/leads + /api/conversas (sempre, async)
```

---

## n8n Workflows Planejados

| Workflow | Trigger | Acao |
|----------|---------|------|
| follow-up-proposta | Cron diario 10h | Mensagem para leads com proposta sem resposta > 2 dias |
| proposta-vencida | Cron diario 10h | Marca expirada + convida a renovar |
| reativacao-lead-frio | Cron semanal | Lead sem contato > 7 dias: mensagem de reativacao |
| lembrete-checkin | Cron diario 9h | Reservas com check-in amanha: detalhes e acesso |
| cobranca-saldo | Cron diario 11h | Reservas com saldo pendente < 7 dias do check-in |
| pesquisa-satisfacao | Webhook checkout | D+1 apos check-out: link de avaliacao |
| relatorio-diario | Cron 18h | KPIs do dia para admin via WhatsApp |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Luna errando sinal [CONFIRMAR] | Alto | Validar dados antes de criar reserva; human review primeiros 30 |
| n8n spam para hospedes | Alto | Rate limit: max 1 msg/semana por lead; opt-out funcional |
| PIX expirado antes de pagar | Medio | Expiracao 48h (padrao); re-gerar sob demanda |
| Disponibilidade desatualizada | Alto | SELECT FOR UPDATE + invalidacao de cache na confirmacao |
| Migracao Google Sheets -> Supabase com falha | Medio | Rodar em paralelo por 30 dias; rollback para Sheets se necessario |

---

## Dependencies

**Depends on:**
- EPIC-PLU-06 (Supabase + API CRM)
- EPIC-PLU-01 PLU-01.3 (fluxo completo Luna operacional)

**Blocks:**
- EPIC-PLU-08 (Dashboard — precisa de dados no Supabase)
- EPIC-PLU-04 (CRM Retencao — reusa leads/reservas do Supabase)

---

## Luna System Prompt Updates (PLU-07.1)

Mudancas necessarias no `services/luna/system-prompt.js`:

1. **[CONFIRMAR]** — expandir payload para criar reserva completa:
   ```
   [CONFIRMAR: nome=X, whatsapp=X, entrada=DD/MM/YYYY, saida=DD/MM/YYYY,
    tipo=ALA_X, pessoas=N, total=R$X, sinal=R$X]
   ```
2. **[DISPONIVEL?]** — novo sinal para consulta de disponibilidade antes de cotar
3. Contexto de disponibilidade injetado no prompt (cache 5min)
4. Historico de leads/conversas lido do Supabase (substituindo Google Sheets)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Epic criado a partir de crm-automacao-arquitetura.md | Morgan (@pm) |
