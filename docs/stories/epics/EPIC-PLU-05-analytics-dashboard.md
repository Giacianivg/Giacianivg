# EPIC-PLU-05: Analytics e Dashboard de Receita

**Status:** 📋 Planning
**Owner:** Morgan (@pm)
**Created:** 2026-02-22
**Prioridade:** 🟢 MÉDIA — Suporte à tomada de decisão dos demais épicos

---

## Objective

Criar dashboard unificado de métricas que consolide dados de ocupação, receita, origem de reservas, performance de ads e retenção — fornecendo visibilidade em tempo real para gestão tomar decisões baseadas em dados rumo à meta de R$100k/mês.

## Business Value

- **Impacto indireto:** Acelera otimização dos outros 4 épicos
- **Velocidade de decisão:** Gestão vê resultado de ações em <24h (vs. esperar relatório manual)
- **Responsabilização:** KPIs visíveis criam cultura de performance na equipe
- **Previsibilidade:** Projeção de receita mensal com base em reservas confirmadas + pipeline

---

## Stakeholders

- Gestão da Pousada (usuário principal do dashboard)
- @data-engineer (estrutura de dados e ETL)
- @analyst (design de métricas e insights)

---

## Scope

### In Scope
- Google Analytics 4 configurado no site da pousada com eventos de reserva
- Dashboard Looker Studio (Google Data Studio) com:
  - Ocupação atual e projetada (30/60/90 dias)
  - Receita: realizada, confirmada e pipeline
  - Origem das reservas: Booking.com vs. direto vs. WhatsApp
  - Performance de ads: impressões, cliques, CPL, conversões
  - Retenção: novos vs. recorrentes, NPS médio
  - RevPAR, ADR (Average Daily Rate), taxa de ocupação
- Alertas automáticos: ocupação <40% na semana seguinte → notificação no WhatsApp da gestão
- Relatório semanal automático via WhatsApp (resumo dos KPIs principais)

### Out of Scope
- BI avançado com SQL customizado — fase 2
- Previsão de demanda com ML — fase 2
- Integração direta com sistema de reservas do Booking (sem API oficial)
- App mobile de dashboard — usar Looker Studio mobile

---

## Stories

| ID | Title | Points | Priority | Status | Executor | Quality Gate |
|----|-------|--------|----------|--------|----------|-------------|
| PLU-05.1 | GA4 + GTM configurados com eventos de reserva | 3 | Alta | Draft | @dev | @data-engineer |
| PLU-05.2 | Dashboard Looker Studio: KPIs de receita e ocupação | 5 | Alta | Draft | @data-engineer | @analyst |
| PLU-05.3 | Alertas automáticos e relatório semanal via WhatsApp | 5 | Média | Draft | @dev | @pm |

**Total Points:** 13

---

## Success Criteria

- [ ] GA4 registrando sessões, eventos de contato e reservas no site
- [ ] Dashboard Looker Studio atualizado diariamente com dados reais
- [ ] Todos os KPIs do brief.md visíveis em uma única tela
- [ ] Alerta automático de baixa ocupação funcionando (teste em <7 dias após implantação)
- [ ] Relatório semanal enviado toda segunda-feira às 8h no WhatsApp da gestão
- [ ] Gestão consegue responder "Qual nossa receita esta semana?" em <30 segundos

---

## Technical Requirements

- Google Analytics 4 (gratuito)
- Google Tag Manager instalado no site
- Google Looker Studio (gratuito) com connectors:
  - Google Analytics 4
  - Google Sheets (dados de reservas do Airtable exportados)
  - Google Ads
- Make.com para trigger de alertas e relatório semanal
- WhatsApp Business API (do EPIC-PLU-01) para envio de alertas

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Site SPA dificulta instalação do GA4/GTM | Médio | Usar GTM com modo de depuração; validar no GA4 Debugger |
| Dados de reserva fragmentados entre canais | Médio | Consolidar manualmente no Airtable como fonte única; automatizar depois |
| Looker Studio sem dados suficientes no início | Baixo | Dashboard inicia com dados manuais; migra para automático em 30 dias |
| Alertas com falsos positivos (spam para gestão) | Baixo | Threshold cuidadoso; no máximo 1 alerta por dia |

---

## Dependencies

**Depends on:**
- EPIC-PLU-01 (WhatsApp API) — para enviar alertas e relatórios
- EPIC-PLU-02 (Meta/Google Ads) — dados de performance de campanhas
- EPIC-PLU-03 (Pricing) — dados de RevPAR e ocupação
- EPIC-PLU-04 (CRM) — dados de retenção e LTV

**Blocks:**
- Nenhum — é o épico de observabilidade dos demais

---

## Documentation

| Type | Location | Status |
|------|----------|--------|
| Project Brief | docs/brief.md | ✅ Done |
| Mapa de KPIs | docs/architecture/kpi-map.md | Pending |
| Template de relatório semanal | docs/guides/weekly-report-template.md | Pending |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-22 | 1.0 | Epic criado via *create-epic | Morgan (@pm) |
