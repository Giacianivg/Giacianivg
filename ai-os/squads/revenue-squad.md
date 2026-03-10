# Squad 5 — Receita e Financeiro

**Líder:** CFO Agent (`ai-os/board/cfo-agent.md`)
**Atualizado:** 2026-03-10 — DEC-013

---

## Missão

Maximizar a receita por quarto e garantir que cada hóspede volte. O Squad 5 faz o dinheiro trabalhar — pricing inteligente, reativação de hóspedes e crescimento de MRR.

---

## Membros

| Agente | Arquivo | Papel no Squad |
|--------|---------|----------------|
| Revenue Optimization Engine | `ai-os/data/revenue-optimization.md` | Precificação dinâmica por temporada e demanda |
| CRM Agent | `agents/crm-agent.md` | Reativação pós-estadia, fidelidade, NPS (planejado) |
| @analyst | (role AIOS, shared) | RevPAR, ADR, ocupação, receita por canal |

---

## Responsabilidades

- Dynamic pricing automático (alta/baixa/feriados)
- Régua de reativação de hóspedes (D+7, D+30, D+90)
- Upsell durante jornada (pré check-in, durante estadia, pós)
- Segmentação de hóspedes por frequência e ticket
- Monitoramento de RevPAR e MRR
- Projeções financeiras para o board

---

## KPIs

| Métrica | Target | Fonte |
|---------|--------|-------|
| RevPAR | > R$280 | `services/analytics/revenue-analytics.js` |
| Hóspede recorrente | > 20% | `services/crm/index.js` |
| Upsell rate | > 15% | `services/crm/index.js` |
| MRR | Crescendo MoM | `services/analytics/revenue-analytics.js` |
| Ticket médio | > R$1.200 | `services/analytics/revenue-analytics.js` |

---

## Linha de Reporte

```
CFO Agent
  ↓
Revenue Optimization Engine | CRM Agent | @analyst
  ↓
Board via Decision Engine (quando necessário)
```

---

## Nível de Decisão

- **N3 (autônomo):** análise de RevPAR, relatório de receita, diagnóstico de pricing
- **N2 (board vota):** novo pacote, ajuste de tabela de preços, programa de fidelidade
- **N1 (founder):** mudança de pricing estrutural, novo produto/serviço
