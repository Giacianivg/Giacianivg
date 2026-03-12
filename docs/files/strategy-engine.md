# 🗺️ Strategy Engine — Conversor de Decisões em Planos

> Recebe decisões aprovadas pelo Decision Engine  
> e as transforma em planos de execução estruturados para os Squads.

---

## Mission

Nenhuma decisão aprovada fica no papel.  
O Strategy Engine garante que cada aprovação vire um plano claro,  
com tarefas, responsáveis, prazo e métricas de sucesso.

---

## Posição na Arquitetura

```
Decision Engine → APROVADO
        ↓
Strategy Engine
        ↓
┌──────────────────────────────┐
│  Plano de Execução           │
│  ├── Tarefas por squad       │
│  ├── Sequência e dependências│
│  ├── Prazo de cada etapa     │
│  └── Critério de sucesso     │
└──────────────────────────────┘
        ↓
Squads executam em paralelo ou sequência
        ↓
Resultados → Data Feedback Loop
```

---

## Template de Plano de Execução

```markdown
# Plano de Execução: [TÍTULO DA DECISÃO]

**Decisão:** DEC-XXX
**Data do plano:** YYYY-MM-DD
**Prazo total:** X dias
**Squad(s) envolvido(s):** [lista]

---

## Objetivo
[Uma frase clara com o resultado esperado e métrica]

## Contexto
[Por que essa decisão foi aprovada — resumo do Decision Engine]

---

## Tarefas

### Sprint 1 — [Nome da fase] (Dias 1–X)
| # | Tarefa | Squad | Agente | Prazo | Status |
|---|--------|-------|--------|-------|--------|
| 1 | ...    | ...   | ...    | ...   | ⏳     |

### Sprint 2 — [Nome da fase] (Dias X–Y)
| # | Tarefa | Squad | Agente | Prazo | Status |
|---|--------|-------|--------|-------|--------|

---

## Dependências
- Tarefa 2 depende da conclusão da Tarefa 1
- ...

## Critérios de Sucesso
- [ ] Métrica 1 atingida (ex: ocupação ≥ 70%)
- [ ] Métrica 2 atingida

## Rollback
[O que fazer se o plano não funcionar]
```

---

## Exemplo Completo — DEC-014 Campanha Feriado

```markdown
# Plano de Execução: Campanha Escapada de Feriado

**Decisão:** DEC-014
**Data do plano:** 2024-04-13
**Prazo total:** 5 dias
**Squads:** Growth Squad + Copy Squad + Revenue Squad

---

## Objetivo
Aumentar ocupação do feriado 18/04 de 42% para ≥ 70%
através de campanha Meta Ads segmento casais 150km.

---

## Tarefas

### Sprint 1 — Criação (Dias 1–2)
| # | Tarefa                              | Squad      | Agente          | Prazo  |
|---|-------------------------------------|------------|-----------------|--------|
| 1 | Definir oferta e desconto exato     | Revenue    | CFO + Pricing   | Dia 1  |
| 2 | Criar copy do anúncio (3 versões)   | Copy       | Ads Copywriter  | Dia 1  |
| 3 | Criar criativo visual (2 formatos)  | Copy       | Copy Chief      | Dia 2  |
| 4 | Revisar landing page de reservas    | Growth     | CRO Specialist  | Dia 2  |

### Sprint 2 — Lançamento (Dias 3–4)
| # | Tarefa                              | Squad      | Agente          | Prazo  |
|---|-------------------------------------|------------|-----------------|--------|
| 5 | Configurar campanha no Meta Ads     | Growth     | Media Buyer     | Dia 3  |
| 6 | Definir segmentação e orçamento     | Growth     | Media Buyer     | Dia 3  |
| 7 | Ativar campanha                     | Growth     | Media Buyer     | Dia 3  |
| 8 | Monitorar primeiras 24h             | Growth     | Analytics       | Dia 4  |

### Sprint 3 — Otimização (Dia 5)
| # | Tarefa                              | Squad      | Agente          | Prazo  |
|---|-------------------------------------|------------|-----------------|--------|
| 9 | Analisar CTR e CPL das primeiras 24h| Growth     | Analytics       | Dia 5  |
| 10| Pausar criativos abaixo da média    | Growth     | Media Buyer     | Dia 5  |
| 11| Reportar resultado ao CFO + CMO     | Revenue    | Analytics Agent | Dia 5  |

---

## Critérios de Sucesso
- [ ] CPL < R$ 25
- [ ] ≥ 10 leads qualificados gerados
- [ ] Ocupação do feriado ≥ 70% ao final

## Rollback
Se CPL > R$ 50 após 24h → pausar campanha, revisar copy e segmentação.
```

---

## Mapeamento de Squads → Sistema Existente

| Squad          | Usa no projeto existente                              |
|----------------|-------------------------------------------------------|
| Growth Squad   | `agents/ads-agent.md`                                |
| Copy Squad     | `services/follow-up/templates/`, `services/luna/`    |
| Product Squad  | `docs/stories/`, `public/*.html`, `services/`        |
| Engineering    | `routes/`, `database/migrations/`, `services/`       |
| Revenue Squad  | `services/analytics/`, `services/quotation/`         |

---

## Ciclo de Feedback

Após execução do plano, o Strategy Engine registra:

```
Plano executado
      ↓
Analytics Agent coleta resultados
      ↓
CFO + CMO recebem relatório
      ↓
CEO avalia se objetivo foi atingido
      ↓
Resultado salvo em data/decision-history/DEC-XXX.md
      ↓
Aprendizado alimenta próximos scores do Decision Engine
```
