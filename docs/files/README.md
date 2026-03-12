# 🧠 AI Operating System — Pousada Luz da Lua

> Camada de inteligência estratégica sobre o sistema existente.  
> **Não substitui nada. Estende tudo.**

---

## 📐 Onde este módulo se encaixa

```
PROJETO EXISTENTE (não modificado)
├── agents/          ← Luna, CRM, Ads, Reservations
├── services/        ← Luna, CRM, WhatsApp, Follow-up...
├── routes/          ← 13 módulos de rota
└── api/             ← Vercel serverless functions

NOVO — AI Operating System (esta pasta)
└── ai-os/
    ├── board/           ← C-Level Agents (CEO, CMO, CPO, CTO, CFO)
    ├── decision-engine/ ← Votação ponderada + scoring
    ├── strategy-engine/ ← Converte decisões em planos executáveis
    ├── squads/          ← Growth, Copy, Product, Engineering, Revenue
    ├── agents/          ← Execution agents especializados
    ├── workflows/       ← Fluxos completos de ponta a ponta
    ├── data/            ← Demand Prediction + Revenue Optimization
    └── docs/            ← Documentação e histórico de decisões
```

---

## 🔗 Integrações com sistema existente

| AI-OS Component       | Usa do sistema existente                          |
|-----------------------|---------------------------------------------------|
| Demand Prediction     | `services/analytics/revenue-analytics.js`        |
| Decision Engine       | `services/scoring/lead-scorer.js` (padrão)       |
| CMO → Growth Squad    | `agents/ads-agent.md`                            |
| CPO → Product Squad   | `docs/stories/` + `docs/prd/`                    |
| CFO → Revenue Squad   | `services/analytics/funnel-analytics.js`         |
| CTO → Eng Squad       | `routes/` + `services/`                          |
| Strategy Engine       | `services/follow-up/` (execução de tarefas)      |
| CEO → AIOS Master     | `.aios-core/` (orchestrator existente)           |

---

## ⚡ Como usar

1. Leve qualquer decisão estratégica para o **CEO Agent** (`board/ceo-agent.md`)
2. O CEO aciona o **Decision Engine** (`decision-engine/decision-engine.md`)
3. C-Levels votam e o **Strategy Engine** cria o plano
4. Squads executam usando os serviços e agentes já existentes
5. Resultados voltam para o **Data Feedback Loop**

---

## 🚫 O que este módulo NÃO faz

- Não modifica `server.js`, `vercel.json` ou qualquer rota existente
- Não cria novas tabelas no Supabase sem migration versionada
- Não altera o bot Luna nem o webhook do WhatsApp
- Não substitui o AIOS Master existente — trabalha abaixo dele

---

## 📊 Arquitetura completa

```
Founder / User
      ↓
AIOS Master (.aios-core — existente)
      ↓
CEO Agent (board/ceo-agent.md)
      ↓
Decision Engine (decision-engine/)
      ↓
AI Board vota: CMO + CPO + CTO + CFO
      ↓
Strategy Engine (strategy-engine/)
      ↓
Squads especializados (squads/)
      ↓
Execution Agents (agents/) + Serviços existentes
      ↓
Data Feedback Loop (data/)
      ↓
Revenue Optimization → de volta ao CEO
```
