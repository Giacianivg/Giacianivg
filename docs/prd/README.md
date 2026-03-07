# Product Requirements Documents (PRD)

Central de PRDs do Pousada Luz da Lua.

## Documents

### Active PRDs

| PRD | Status | Escopo | Versão |
|-----|--------|--------|--------|
| **[CRM-RMS-PRD.md](./CRM-RMS-PRD.md)** | 🟢 APPROVED | CRM Web + RMS Foundation (Phase 1 + 2) | 1.0 |

### Historical

| PRD | Status | Escopo | Versão |
|-----|--------|--------|--------|
| [technical-debt-assessment.md](./technical-debt-assessment.md) | ✅ Completed | Brownfield Discovery — 10 fases | 1.0 |
| [technical-debt-DRAFT.md](./technical-debt-DRAFT.md) | 📋 Draft | Technical debt assessment (rascunho) | 0.9 |

---

## CRM-RMS PRD — Quick Reference

### Executive Summary
- **Visão:** CRM Web operacional + base para RMS futuro
- **Problema:** Leads dispersos, sem analytics, preços fixos
- **Solução:** Next.js 14 + React + PostgreSQL
- **Timeline:** 5 semanas (Phase 1: 3 semanas, Phase 2: 4 semanas)
- **ROI:** +R$45k/mês em 2 fases

### Phase 1: CRM Operacional (3 semanas)
- Dashboard com KPIs
- CRUD de leads, reservas, clientes
- Calendário visual
- Analytics básico
- **Meta:** R$30k → R$45k/mês

### Phase 2: RMS Foundation (4 semanas)
- Demand forecasting
- Pricing optimizer (recomendações)
- RMS Dashboard
- Histórico de conversão estruturado
- **Meta:** R$45k → R$75k/mês

---

## Como Usar Este Document

### Para Stakeholders
1. Leia [CRM-RMS-PRD.md](./CRM-RMS-PRD.md) — seções:
   - EXECUTIVE SUMMARY (visão geral)
   - PRODUCT VISION (roadmap)
   - SUCCESS METRICS (KPIs)

### Para Desenvolvedores
1. Leia [CRM-RMS-PRD.md](./CRM-RMS-PRD.md) — seções:
   - TECHNICAL REQUIREMENTS (tech stack)
   - Implementation Timeline (fases)
   - APPENDIX (API contracts, data model)

### Para Product Manager
1. Leia [CRM-RMS-PRD.md](./CRM-RMS-PRD.md) — todas as seções
2. Use como source of truth para:
   - Stories (EPIC-PLU-04 ou similar)
   - Acceptance criteria
   - Backlog prioritization

### Para Arquiteto
1. Leia [CRM-RMS-PRD.md](./CRM-RMS-PRD.md) — seções:
   - TECHNICAL REQUIREMENTS
   - Architecture Diagram
   - Data Model
   - RISK & MITIGATION

---

## Status do CRM-RMS PRD

| Fase | Status | Próximos Passos |
|------|--------|-----------------|
| Kickoff | ✅ Complete | Aprovação final + kickoff Week 1 |
| Phase 0 (Setup) | 📋 Pending | Criar repo, Next.js scaffolding |
| Phase 1 (CRM MVP) | 📋 Pending | Implementação Week 1-3 |
| Phase 2 (RMS Foundation) | 📋 Pending | Começar Week 4 |

---

## Referências Cruzadas

Veja também:
- [Architecture Docs](../architecture/) — Detailed design documents
- [Stories](../stories/) — EPIC-PLU-04 (será criado para CRM)
- [Make.com Blueprints](../make-com/) — Integrações
- [Airtable Schema](../architecture/airtable-schema.md) — Data model

---

**Última atualização:** 2026-03-07 (@pm)
