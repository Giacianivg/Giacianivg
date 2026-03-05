# EPIC-PLU-03: Pricing Dinâmico e Gestão de Ocupação

**Status:** 📋 Planning
**Owner:** Morgan (@pm)
**Created:** 2026-02-22
**Prioridade:** 🟡 ALTA — Maximiza receita por quarto disponível

---

## Objective

Implementar sistema de pricing dinâmico que ajuste tarifas automaticamente com base em sazonalidade, ocupação atual e demanda, aumentando o RevPAR de ~R$55 para R$185+ por quarto por noite.

## Business Value

- **Impacto estimado:** +R$15-20k/mês via otimização de tarifa
- **RevPAR atual:** ~R$55/noite → **Meta:** R$185/noite (+236%)
- **Prevenção de perda:** Evita cobrar R$200 em feriados quando poderia cobrar R$450
- **Competitividade:** Paridade de preço inteligente vs. concorrentes da região

---

## Stakeholders

- Gestão da Pousada (define faixas de preço e limites)
- @dev (implementação do motor de pricing)
- @data-engineer (estrutura de dados de ocupação)

---

## Scope

### In Scope
- Calendário de tarifas com 3 períodos: alta, média e baixa temporada (base)
- Motor de regras: ocupação >80% → +20% na tarifa | <30% com >7 dias de antecedência → -15%
- Painel de controle simples para gestão ajustar preços manualmente
- Integração de consulta de disponibilidade para cálculo automático
- Alertas: "quarto disponível em feriado a preço baixo" → sugestão de ajuste
- Paridade de preço vs. Booking.com (não vender mais barato direto)

### Out of Scope
- Machine learning preditivo com histórico — fase 2
- Revenue Management System (RMS) comercial (Duetto, IDeaS) — avaliação futura
- Integração automática de atualização de preço no Booking.com via Channel Manager — fase 2
- Pricing por tipo de quarto individual — MVP usa tarifa única por categoria

---

## Stories

| ID | Title | Points | Priority | Status | Executor | Quality Gate |
|----|-------|--------|----------|--------|----------|-------------|
| PLU-03.1 | Calendário tarifário: estrutura de dados e períodos sazonais | 5 | Alta | Draft | @data-engineer | @dev |
| PLU-03.2 | Motor de regras de pricing automático | 8 | Alta | Draft | @dev | @architect |
| PLU-03.3 | Dashboard de gestão de preços e ocupação | 5 | Média | Draft | @dev | @architect |

**Total Points:** 18

---

## Success Criteria

- [ ] Calendário tarifário configurado para 12 meses (alta/média/baixa temporada)
- [ ] Motor de regras aplicando ajustes automáticos corretamente
- [ ] Dashboard mostra ocupação atual, preço por período e sugestões de ajuste
- [ ] RevPAR aumenta 50%+ em 60 dias após implementação
- [ ] Zero instâncias de feriados/alta demanda com preço de baixa temporada
- [ ] Gestão consegue ajustar preços manualmente em <2 minutos

---

## Technical Requirements

- Airtable ou banco de dados simples para calendário tarifário
- Lógica de negócio em Node.js ou Python para motor de regras
- Dashboard: Retool (low-code) ou Google Sheets com fórmulas avançadas
- API de consulta de disponibilidade (integração com sistema atual de reservas)
- Webhook para notificações de alerta de pricing

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Preço aumenta mas conversão cai | Médio | A/B test gradual; monitorar taxa de conversão junto com RevPAR |
| Gestão não adota a ferramenta | Médio | Interface simples; treinamento; alertas proativos em vez de consulta manual |
| Inconsistência de preço entre canais | Alto | Paridade automática: preço direto ≥ preço Booking.com sempre |
| Dados de ocupação histórica indisponíveis | Baixo | Iniciar com regras manuais e coletar dados por 30-60 dias antes de automatizar |

---

## Dependencies

**Depends on:**
- Sistema atual de reservas (entender como consultar disponibilidade)

**Blocks:**
- EPIC-PLU-01 (Funil) — Claude precisa de preços atuais para gerar cotações corretas
- EPIC-PLU-05 (Analytics) — RevPAR é KPI central do dashboard

---

## Documentation

| Type | Location | Status |
|------|----------|--------|
| Project Brief | docs/brief.md | ✅ Done |
| Tabela de sazonalidade Socorro-SP | docs/architecture/seasonality-calendar.md | Pending |
| Regras de pricing | docs/architecture/pricing-rules.md | Pending |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-22 | 1.0 | Epic criado via *create-epic | Morgan (@pm) |
