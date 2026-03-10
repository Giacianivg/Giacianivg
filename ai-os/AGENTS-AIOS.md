# 🤖 AGENTS-AIOS — Mapa de Agentes do AI Operating System

> Índice de todos os agentes do AI OS da Pousada Luz da Lua.

---

## AI Board (C-Level Agents)

| Agente | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| CEO    | `ai-os/board/ceo-agent.md`  | Direção estratégica, Pareto³, orquestração |
| CMO    | `ai-os/board/cmo-agent.md`  | Marketing, aquisição, Growth + Copy Squads |
| CPO    | `ai-os/board/cpo-agent.md`  | Produto, UX, roadmap, Product Squad |
| CTO    | `ai-os/board/cto-agent.md`  | Arquitetura, infra, Engineering Squad |
| CFO    | `ai-os/board/cfo-agent.md`  | Finanças, pricing, Revenue Squad |

---

## Engines

| Engine | Arquivo | Função |
|--------|---------|--------|
| Decision Engine  | `ai-os/decision-engine/decision-engine.md`  | Votação ponderada do board |
| Strategy Engine  | `ai-os/strategy-engine/strategy-engine.md`  | Planos de execução |
| Demand Prediction | `ai-os/data/demand-prediction.md`          | Previsão de ocupação |
| Revenue Optimization | `ai-os/data/revenue-optimization.md`    | Precificação dinâmica |

---

## Squads

| Squad | Arquivo | C-Level Responsável |
|-------|---------|---------------------|
| Growth Squad   | `ai-os/squads/growth-squad.md`   | CMO |
| Product Squad  | `ai-os/squads/product-squad.md`  | CPO |
| Revenue Squad  | `ai-os/squads/revenue-squad.md`  | CFO |

---

## Agentes Existentes (sistema base)

| Agente | Arquivo | Função |
|--------|---------|--------|
| Luna   | `agents/luna.md`                | Bot WhatsApp — atendimento e cotação |
| Reservations | `agents/reservations-agent.md` | Gestão de reservas |
| CRM    | `agents/crm-agent.md`           | Gestão de leads e clientes |
| Ads    | `agents/ads-agent.md`           | Campanhas Meta Ads |

---

## Fluxo de Orquestração

```
Founder / Sistema
      ↓
CEO Agent (Pareto³)
      ↓
Decision Engine (votação board)
      ↓
Strategy Engine (plano de execução)
      ↓
Squads executam
      ↓
Data → Feedback Loop → CEO
```

---

## Integrações com AIOS Master

- CEO Agent integra com `.aios-core/` para receber contexto do projeto
- Todos os agentes respeitam as regras em `CLAUDE.md`
- Decisões registradas em `ai-os/data/decision-history/`
