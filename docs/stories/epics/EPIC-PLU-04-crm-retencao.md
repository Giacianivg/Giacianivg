# EPIC-PLU-04: CRM e Programa de Retenção

**Status:** 📋 Planning
**Owner:** Morgan (@pm)
**Created:** 2026-02-22
**Prioridade:** 🟡 ALTA — Reduz CAC e aumenta LTV dos hóspedes

---

## Objective

Implementar CRM de hóspedes e régua de comunicação automatizada para aumentar a taxa de retorno de <10% para >30% ao longo de 12 meses, reduzindo o custo de aquisição e aumentando o LTV médio por hóspede.

## Business Value

- **Impacto estimado:** +R$10-15k/mês em reservas de hóspedes recorrentes
- **LTV atual estimado:** R$400-600 → **Meta:** R$1.500+
- **Redução de CAC:** Hóspede retornante custa 5-7x menos para converter
- **Upsell:** Hóspedes com histórico → pacotes personalizados com maior ticket

---

## Stakeholders

- Equipe de atendimento da pousada
- @dev (automação de CRM e régua)
- @data-engineer (estrutura do banco de dados de hóspedes)

---

## Scope

### In Scope
- CRM no Airtable: cadastro de hóspedes com histórico, preferências e datas de estadia
- Importação de histórico de reservas existentes (Booking.com export)
- Régua de retenção automatizada via WhatsApp:
  - D+1: agradecimento e pedido de avaliação (Google Maps, Booking)
  - D+30: "Sentimos sua falta" + oferta especial retorno
  - D+90: Lembrete de próxima temporada (pacotes antecipados)
  - Datas especiais: aniversário do hóspede, aniversário da primeira visita
- Segmentação básica: tipo (casal, família, grupo), frequência (novo, recorrente, VIP)
- Templates Claude para personalização de mensagens

### Out of Scope
- App de fidelidade com pontos — fase 2
- Email marketing — fase 2 (foco em WhatsApp no MVP)
- NPS survey automatizado formal — fase 2
- Integração bidirecional com Booking.com CRM — não disponível via API

---

## Stories

| ID | Title | Points | Priority | Status | Executor | Quality Gate |
|----|-------|--------|----------|--------|----------|-------------|
| PLU-04.1 | Setup CRM Airtable: schema de hóspedes e importação histórico | 5 | Alta | Draft | @data-engineer | @dev |
| PLU-04.2 | Régua de retenção automatizada via WhatsApp + Claude | 8 | Alta | Draft | @dev | @architect |
| PLU-04.3 | Segmentação e campanhas de retorno por perfil de hóspede | 5 | Média | Draft | @dev | @pm |

**Total Points:** 18

---

## Success Criteria

- [ ] 100% das reservas registradas no CRM Airtable (novas + histórico importado)
- [ ] Régua D+1 enviando agradecimentos automaticamente após check-out
- [ ] Taxa de abertura de mensagens WhatsApp >60%
- [ ] Taxa de retorno de hóspedes aumenta de <10% para >20% em 6 meses
- [ ] Pelo menos 2 upsells de pacotes especiais convertidos por mês via régua
- [ ] Zero LGPD violations: opt-out funcional em todas as mensagens automáticas

---

## Technical Requirements

- Airtable (base de dados principal de hóspedes)
- Make.com (orquestração de régua: trigger por data + WhatsApp Business API)
- WhatsApp Business API (do EPIC-PLU-01 — dependência crítica)
- Claude API para personalização de mensagens
- LGPD compliance: registro de consentimento e mecanismo de opt-out

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hóspedes marcam como spam no WhatsApp | Alto | Frequência controlada (max 1 msg/mês); opt-out fácil e visível; conteúdo sempre relevante |
| Dados históricos do Booking.com incompletos | Médio | Exportar o que há; completar manualmente os mais recentes/frequentes |
| LGPD: comunicação sem consentimento explícito | Alto | Coletar consentimento no check-in; não enviar para hóspedes sem opt-in |
| Personalização do Claude inadequada | Baixo | Testar templates antes de ativar; human-review nas primeiras 20 mensagens |

---

## Dependencies

**Depends on:**
- EPIC-PLU-01 (WhatsApp Business API) — régua usa o mesmo canal
- Exportação de histórico de reservas do Booking.com

**Blocks:**
- EPIC-PLU-05 (Analytics) — LTV e taxa de retorno alimentam o dashboard

---

## Documentation

| Type | Location | Status |
|------|----------|--------|
| Project Brief | docs/brief.md | ✅ Done |
| Schema CRM Airtable | docs/architecture/crm-schema.md | Pending |
| Régua de comunicação | docs/guides/retention-playbook.md | Pending |
| Política de privacidade LGPD | docs/guides/lgpd-policy.md | Pending |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-22 | 1.0 | Epic criado via *create-epic | Morgan (@pm) |
