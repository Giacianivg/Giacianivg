# AGENTS-AIOS — Mapa de Agentes do AI Operating System

> Índice de todos os agentes do AI OS da Pousada Luz da Lua.
> Última atualização: 2026-03-10 — DEC-013 (Reestruturação de Squads)

---

## AI Board (C-Level Agents)

| Agente | Arquivo | Responsabilidade | Peso Decision Engine |
|--------|---------|-----------------|----------------------|
| CEO | `ai-os/board/ceo-agent.md` | Direção estratégica, Pareto³, coordena board | 30% |
| CMO | `ai-os/board/cmo-agent.md` | Marketing, aquisição, Squad 2 | 25% |
| CPO | `ai-os/board/cpo-agent.md` | Produto, UX, roadmap, Squad 3 | 20% |
| CTO | `ai-os/board/cto-agent.md` | Arquitetura, infra, veto técnico, Squad 4 | 15% |
| CFO | `ai-os/board/cfo-agent.md` | Finanças, pricing dinâmico, Squad 5 | 10% |

---

## Engines

| Engine | Arquivo | Função |
|--------|---------|--------|
| Decision Engine | `ai-os/decision-engine/decision-engine.md` | Votação ponderada do board |
| Strategy Engine | `ai-os/strategy-engine/strategy-engine.md` | Planos de execução |
| Demand Prediction | `ai-os/data/demand-prediction.md` | Previsão de ocupação 60 dias |
| Revenue Optimization | `ai-os/data/revenue-optimization.md` | Precificação dinâmica |

---

## 5 Squads Formais

| Squad | Arquivo | Líder | KPI Principal |
|-------|---------|-------|---------------|
| Squad 1 — Operações | `ai-os/squads/ops-squad.md` | CEO | Ocupação qui-dom > 80% |
| Squad 2 — Marketing | `ai-os/squads/growth-squad.md` | CMO | CAC < R$150 |
| Squad 3 — Produto | `ai-os/squads/product-squad.md` | CPO | NPS > 8 |
| Squad 4 — Engenharia | `ai-os/squads/engineering-squad.md` | CTO | 139/139 testes |
| Squad 5 — Receita | `ai-os/squads/revenue-squad.md` | CFO | RevPAR > R$280 |

---

## Agentes de Negócio

| Agente | Arquivo | Status | Squad | Função |
|--------|---------|--------|-------|--------|
| Luna | `agents/luna.md` | **Ativo em Produção** | Squad 1 | Bot WhatsApp — atendimento, cotação, relay |
| Marcus | `agents/meta-agent.md` | **Ativo** | Squad 2 | CMO Field — Meta Ads Specialist |
| Reservations Agent | `agents/reservations-agent.md` | Planejado | Squad 1 | Gestão de reservas e disponibilidade |
| CRM Agent | `agents/crm-agent.md` | Planejado | Squad 5 | Reativação e fidelidade de hóspedes |
| Ads Agent | `agents/ads-agent.md` | **DEPRECATED** | — | Substituído por Marcus (meta-agent.md) |

---

## Roles AIOS (Framework)

| Role | Ativação | Squad Principal | Função |
|------|----------|----------------|--------|
| @aios-master (Orion) | `@aios-master` | — | Orquestrador geral, governance |
| @pm (Morgan) | `@pm` | Squad 3 | Stories + validação (absorveu @sm e @po — DEC-013) |
| @dev (Dex) | `@dev` | Squad 4 | Implementação, commits |
| @qa | `@qa` | Squad 4 | Quality gate, 7 checks |
| @devops (Gage) | `@devops` | Squad 4 | Deploy, infra, MCP (exclusivo) |
| @architect (Aria) | `@architect` | Squads 3+4 | Arquitetura, veto técnico (shared) |
| @data-engineer (Dara) | `@data-engineer` | Squad 4 | Schema, migrations, queries |
| @analyst | `@analyst` | Squads 1+2+5 | Dados, insights (shared) |

> **Deprecados (DEC-013):** @po (Pax) → absorvido por @pm | @sm (River) → absorvido por @pm

---

## Fluxo de Orquestração

```
Vitor (Founder) — N1: decisões estratégicas
      ↓
Orion (@aios-master) — governance e orquestração
      ↓
CEO Agent — aplica Pareto³
      ↓
Decision Engine — votação ponderada (CEO 30% | CMO 25% | CPO 20% | CTO 15% | CFO 10%)
      ↓
Strategy Engine — plano de execução
      ↓
Squads 1-5 executam
      ↓
Data → Feedback Loop → CEO
```

---

## Níveis de Decisão

| Nível | Quem decide | Exemplos |
|-------|------------|---------|
| N1 — Founder | Vitor aprova | Preços, deploy crítico, campanha paga, novo épico |
| N2 — Board | Board vota, Vitor aprova | Features, ajustes, migrations, novo criativo |
| N3 — Autônomo | Agente executa | Diagnóstico, leitura, stories, testes, análises |
