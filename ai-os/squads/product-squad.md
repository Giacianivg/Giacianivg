# Squad 3 — Produto e Experiência

**Líder:** CPO Agent (`ai-os/board/cpo-agent.md`)
**Atualizado:** 2026-03-10 — DEC-013

---

## Missão

Garantir que o sistema da pousada evolua continuamente entregando a melhor experiência para hóspedes e para o time operacional. O Squad 3 transforma requisitos em produto — sem regressão, sem fricção.

---

## Membros

| Agente | Arquivo | Papel no Squad |
|--------|---------|----------------|
| @pm Morgan | (role AIOS) | Stories, requisitos, validação de AC, backlog (absorveu @sm e @po — DEC-013) |
| @architect Aria | (role AIOS, shared com Squad 4) | Decisões técnicas de produto, trade-offs de UX |
| @analyst | (role AIOS, shared) | NPS, feedback de hóspedes, friction analysis |
| Copy | (role interno) | Textos do bot, landing, propostas |
| Design | (role interno) | Design System Luz da Lua, UX do funil |

---

## Responsabilidades

- Manter e priorizar o roadmap do produto
- Criar e validar stories (SDC Fases 1 e 2 — @pm unificado)
- Qualidade de UX nas interfaces CRM e bot
- Identificar e eliminar fricções no funil de reservas
- Design System (`public/design-system/`)
- Redução de tempo-para-reserva

---

## KPIs

| Métrica | Target | Fonte |
|---------|--------|-------|
| NPS | > 8 | Feedback pós-estadia |
| Features entregues sem regressão | 100% | @qa gate |
| Taxa abandono funil | < 30% | `services/analytics/funnel-analytics.js` |
| Time-to-reserve | < 10 min | `services/whatsapp/webhook.js` |

---

## Linha de Reporte

```
CPO Agent
  ↓
@pm Morgan | @architect Aria* | @analyst | Copy | Design
  ↓
Board via Decision Engine (quando necessário)
```

*@architect é shared com Squad 4. Veto técnico reporta ao CTO.

---

## Nível de Decisão

- **N3 (autônomo):** criar story, validar AC, análise de NPS
- **N2 (board vota):** nova feature significativa, mudança de UX no funil principal
- **N1 (founder):** mudança na identidade da Luna, novo canal de atendimento
