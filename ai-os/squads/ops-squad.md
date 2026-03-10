# Squad 1 — Operações e Estratégia

**Líder:** CEO Agent (`ai-os/board/ceo-agent.md`)
**Criado:** 2026-03-10 — DEC-013

---

## Missão

Garantir que a pousada opere com máxima eficiência e que cada hóspede tenha uma experiência que gere reserva recorrente. O Squad 1 é o motor de conversão — da primeira mensagem à reserva confirmada.

---

## Membros

| Agente | Arquivo | Papel no Squad |
|--------|---------|----------------|
| Luna | `agents/luna.md` | Atendimento WhatsApp, qualificação e conversão de leads |
| Reservations Agent | `agents/reservations-agent.md` | Gestão de reservas, disponibilidade e confirmação |
| Demand Prediction Engine | `ai-os/data/demand-prediction.md` | Previsão de ocupação 60 dias, alertas de baixa demanda |
| @analyst | (role AIOS) | Dados operacionais, insights e relatórios para o CEO |

---

## Responsabilidades

- Atendimento 24/7 via Luna (WhatsApp)
- Conversão de leads qualificados em reservas confirmadas
- Previsão de ocupação e acionamento proativo de campanhas
- Monitoramento de disponibilidade qui-dom
- Relay equipe→hóspede para situações escaladas

---

## KPIs

| Métrica | Target | Fonte |
|---------|--------|-------|
| Ocupação qui-dom | > 80% | `services/analytics/revenue-analytics.js` |
| Tempo resposta Luna | < 2s | `services/whatsapp/webhook.js` |
| CAC | < R$150 | `services/crm/index.js` |
| Taxa conversão lead→reserva | > 8% | `services/analytics/funnel-analytics.js` |

---

## Linha de Reporte

```
CEO Agent
  ↓
Luna | Reservations Agent | Demand Prediction | @analyst
  ↓
Board via Decision Engine (quando necessário)
```

---

## Nível de Decisão

- **N3 (autônomo):** Luna atende, cota, escalona — sem aprovação
- **N2 (board vota):** nova política de atendimento, mudança no funil
- **N1 (founder):** mudança nos preços, nova ala de quartos
