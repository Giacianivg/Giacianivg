# Squad 2 — Marketing e Aquisição

**Líder:** CMO Agent (`ai-os/board/cmo-agent.md`)
**Atualizado:** 2026-03-10 — DEC-013

---

## Missão

Adquirir novos hóspedes com custo eficiente e otimizar cada etapa do funil — do anúncio à primeira mensagem no WhatsApp. O Squad 2 é responsável por encher o topo do funil para o Squad 1 converter.

---

## Membros

| Agente | Arquivo | Papel no Squad |
|--------|---------|----------------|
| Marcus | `agents/meta-agent.md` | CMO Field — Meta Ads, campanhas, criativos, budget |
| @analyst | (role AIOS, shared) | Performance de campanha, atribuição, CAC por canal |
| Media Buyer | (role interno) | Execução de compra de mídia no Meta |
| CRO | (role interno) | Otimização de conversão bot + landing |
| Funnel Builder | (role interno) | Estrutura e copy do funil WhatsApp |

---

## Responsabilidades

- Campanhas Meta Ads (awareness + conversão para Mensagens)
- Otimização de criativos e públicos
- A/B tests de oferta, copy e CTA
- Análise de CAC por campanha
- Gestão de budget por período (alta/baixa temporada)
- Lookalike de hóspedes convertidos

---

## KPIs

| Métrica | Target | Fonte |
|---------|--------|-------|
| CAC | < R$150 | `agents/meta-agent.md` |
| Conversão lead→reserva | > 8% | `services/analytics/funnel-analytics.js` |
| CTR campanhas | > 1.5% | Meta Ads Manager |
| CPM | < R$15 | Meta Ads Manager |
| ROI campanha | > 300% | CFO / Revenue Squad |

---

## Linha de Reporte

```
CMO Agent
  ↓
Marcus (CMO Field) | Media Buyer | CRO | Funnel Builder | @analyst
  ↓
Board via Decision Engine (quando necessário)
```

---

## Nível de Decisão

- **N3 (autônomo):** análise de métricas, diagnóstico, recomendações
- **N2 (board vota):** nova campanha, novo público, novo criativo
- **N1 (founder):** qualquer gasto acima de R$500/mês, novo canal
