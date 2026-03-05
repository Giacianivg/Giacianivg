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

**Total de Pontos:** 88 | **Impacto Total Estimado:** +R$75-100k/mês sobre base atual de R$30k

---

## Sequência de Execução Recomendada

```
Wave 1 (Semanas 1-4): EPIC-PLU-01 + EPIC-PLU-02 em paralelo
  → Ativa o funil de leads e começa a gerar tráfego

Wave 2 (Semanas 3-6): EPIC-PLU-03 + EPIC-PLU-05
  → Maximiza receita por lead gerado e dá visibilidade

Wave 3 (Semanas 5-8): EPIC-PLU-04
  → Retém hóspedes adquiridos e aumenta LTV
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
```
