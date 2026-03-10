# Épicos — Pousada Luz da Lua

**Projeto:** Pousada Luz da Lua | Socorro-SP
**Meta:** R$100k/mês | Margem ≥35%
**Criado:** 2026-02-22

---

## Roadmap de Épicos

| ID | Épico | Prioridade | Pontos | Impacto Estimado | Status |
|----|-------|------------|--------|-----------------|--------|
| [EPIC-PLU-01](./EPIC-PLU-01-funil-vendas-automatizado.md) | Funil de Vendas Automatizado (WhatsApp + Claude) | 🔴 Crítica | 21 | +R$20-25k/mês | Planning |
| [EPIC-PLU-02](./EPIC-PLU-02-marketing-digital.md) | Motor de Marketing Digital (Meta Ads + Google) | 🔴 Crítica | 18 | +R$30-40k/mês | Planning |
| [EPIC-PLU-03](./EPIC-PLU-03-pricing-dinamico.md) | Pricing Dinâmico e Gestão de Ocupação | 🟡 Alta | 18 | +R$15-20k/mês | Planning |
| [EPIC-PLU-04](./EPIC-PLU-04-crm-retencao.md) | CRM e Programa de Retenção | 🟡 Alta | 18 | +R$10-15k/mês | Planning |
| [EPIC-PLU-05](./EPIC-PLU-05-analytics-dashboard.md) | Analytics e Dashboard de Receita | 🟢 Média | 13 | Indireto | Planning |
| [EPIC-PLU-06](./EPIC-PLU-06-crm-reservas.md) | Fundacao CRM — Database, API e Motor de Reservas | 🔴 Alta | 31 | +R$15-20k/mês | Planning |
| [EPIC-PLU-07](./EPIC-PLU-07-luna-crm-automacoes.md) | Luna <-> CRM e Automacoes de Follow-up | 🔴 Alta | 29 | +R$20-25k/mês | Planning |
| [EPIC-PLU-08](./EPIC-PLU-08-dashboard-operacoes.md) | Dashboard de Operacoes e Metricas | 🟡 Média | 24 | Decisões operacionais | Planning |
| [EPIC-PLU-09](./EPIC-PLU-09-design-system.md) | Luz da Lua Design System v1.0 | 🔴 Alta | 31 | Fundação UX/brand | Planning |

**Total de Pontos:** 203 | **Impacto Total Estimado:** +R$110-145k/mês sobre base atual de R$30k

---

## Sequência de Execução Recomendada

```
Wave 1 (Semanas 1-4): EPIC-PLU-01 + EPIC-PLU-02 em paralelo
  → Ativa o funil de leads e começa a gerar tráfego

Wave 2 (Semanas 3-6): EPIC-PLU-03 + EPIC-PLU-05
  → Maximiza receita por lead gerado e dá visibilidade

Wave 3 (Semanas 5-8): EPIC-PLU-04
  → Retém hóspedes adquiridos e aumenta LTV

Wave 4 (Semanas 1-6, paralelo ao PLU-01): EPIC-PLU-06
  → Fundacao CRM: Supabase + API + motor de reservas + PIX

Wave 5 (Semanas 5-10): EPIC-PLU-07
  → Luna consulta CRM, [CONFIRMAR] cria reserva, follow-ups automaticos

Wave 6 (Semanas 9-12): EPIC-PLU-08
  → Dashboard operacional com KPIs, calendario e relatorio diario

Wave 7 (Paralelo, qualquer wave): EPIC-PLU-09
  → Design System: tokens CSS + migração pages + landing pública
```

## Dependências entre Épicos

```
EPIC-PLU-01 (WhatsApp API)
  └─ É pré-requisito de: EPIC-PLU-04 (CRM/Retenção) e EPIC-PLU-05 (alertas)

EPIC-PLU-02 (Ads)
  └─ Alimenta: EPIC-PLU-05 (dados de performance)

EPIC-PLU-03 (Pricing)
  └─ Alimenta: EPIC-PLU-01 (preços para cotação) e EPIC-PLU-05 (RevPAR)

EPIC-PLU-04 (CRM)
  └─ Alimenta: EPIC-PLU-05 (LTV, taxa de retorno)

EPIC-PLU-06 (Fundacao CRM — Supabase + API)
  └─ E pre-requisito de: EPIC-PLU-07 (Luna<->CRM) e EPIC-PLU-08 (Dashboard)

EPIC-PLU-07 (Luna <-> CRM + Automacoes)
  └─ Depende de: EPIC-PLU-06 + EPIC-PLU-01.3
  └─ Alimenta: EPIC-PLU-08 (dados de leads e reservas)

EPIC-PLU-08 (Dashboard)
  └─ Depende de: EPIC-PLU-06 + EPIC-PLU-07
  └─ Alimenta: EPIC-PLU-03 (dados de ocupacao para pricing)
```

---

## Historico de Decisoes (DECs)

Todas as decisoes arquiteturais e estrategicas do sistema sao registradas em `ai-os/data/decision-history/`.

| DEC | Titulo | Data | Score | Status |
|-----|--------|------|-------|--------|
| [DEC-001](../../ai-os/data/decision-history/DEC-001.md) | PRIMEIRA_RECEITA: Ativacao de Leads + Primeira Campanha | 2026-03-10 | 100% | APROVADO |
| [DEC-002](../../ai-os/data/decision-history/DEC-002.md) | EVENT_BUS + COMMAND_CENTER: Camada de Orquestracao e Visibilidade | 2026-03-10 | 92% | IMPLEMENTADO |
| [DEC-003](../../ai-os/data/decision-history/DEC-003.md) | PASCOA_SPRINT: Campanha Meta Ads + Pacote Escapada Romantica | 2026-03-10 | 100% | APROVADO |
| [DEC-004](../../ai-os/data/decision-history/DEC-004.md) | PACOTE_PASCOA: Alteracoes Luna + Engine de Cotacao | 2026-03-10 | 94% | APROVADO |
| [DEC-007](../../ai-os/data/decision-history/DEC-007.md) | BLACKBOARD_MEMORY: Estado Compartilhado Real entre Agentes | 2026-03-10 | 97% | APROVADO |

> Regra: nenhuma feature, bugfix ou mudanca arquitetural sem DEC-XXX.md aprovado.
> Ver `.claude/rules/orquestracao.md` para o fluxo obrigatorio completo.
