# EPIC-PLU-02: Motor de Marketing Digital

**Status:** 📋 Planning
**Owner:** Morgan (@pm)
**Created:** 2026-02-22
**Prioridade:** 🔴 CRÍTICA — Principal alavanca de geração de novos leads

---

## Objective

Estruturar e ativar campanhas de Meta Ads e Google Ads segmentadas para os perfis de hóspedes e grupos da Pousada Luz da Lua, criando um fluxo previsível de leads qualificados que alimenta o funil de WhatsApp automatizado.

## Business Value

- **Impacto estimado:** +R$30-40k/mês em receita adicional via leads qualificados
- **CAC alvo:** <R$150 por reserva convertida
- **Redução de dependência de OTAs:** De ~100% para <50% das reservas em 90 dias
- **Escala:** Campanhas otimizadas por IA aprendem continuamente e melhoram ROAS

---

## Stakeholders

- Gestão da Pousada (aprovação de criativos e budget)
- @analyst (pesquisa de audiências e concorrentes)
- @dev (pixel de rastreamento e integrações)

---

## Scope

### In Scope
- Configuração de Meta Business Suite (pixel, catálogo, públicos)
- 3 campanhas Meta Ads: Awareness (vídeo/foto), Conversão (reserva direta), Remarketing
- Configuração Google Ads: Search (palavras-chave de destino) + Display (remarketing visual)
- Pixel de rastreamento no site da pousada (eventos de reserva)
- Públicos personalizados: visitantes do site, lista de hóspedes, lookalikes
- Dashboard de performance ads (Meta Ads Manager + Google Ads)
- Criativos iniciais: briefing para produção (fotos/vídeos da pousada)

### Out of Scope
- Produção de vídeos profissionais — equipe da pousada fornece conteúdo bruto
- SEO e tráfego orgânico — fase 2
- TikTok Ads, Pinterest Ads — fase 2
- Automação de lances por IA proprietária — usa otimização nativa das plataformas

---

## Stories

| ID | Title | Points | Priority | Status | Executor | Quality Gate |
|----|-------|--------|----------|--------|----------|-------------|
| PLU-02.1 | Setup Meta Business: pixel, públicos e estrutura de conta | 5 | Alta | Draft | @dev | @architect |
| PLU-02.2 | Campanhas Meta Ads ativas (awareness + conversão + remarketing) | 8 | Alta | Draft | @analyst | @pm |
| PLU-02.3 | Google Ads Search + Display configurados e ativos | 5 | Média | Draft | @analyst | @pm |

**Total Points:** 18

---

## Success Criteria

- [ ] Pixel Meta instalado e disparando eventos de pageview e reserva corretamente
- [ ] 3 campanhas Meta Ads ativas com budget definido e públicos segmentados
- [ ] Google Ads Search ativo para palavras-chave "pousada socorro sp" e variações
- [ ] CTR médio campanhas >2%
- [ ] CPL (custo por lead) <R$30
- [ ] Primeiros leads chegando no WhatsApp via anúncios em <7 dias após ativação

---

## Technical Requirements

- Meta Business Suite conta verificada
- Pixel Meta instalado via GTM ou direto no site
- Google Tag Manager configurado no site
- Google Analytics 4 com conversões configuradas
- Budget mensal de ads (recomendado: R$5.000-8.000/mês inicial)
- Acesso ao site da pousada para instalação de pixels

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Site da pousada (SPA) dificulta instalação de pixel | Médio | Usar GTM com eventos customizados; verificar com equipe técnica do site |
| Baixa qualidade dos criativos iniciais | Alto | Briefing detalhado para equipe; usar fotos de stock como fallback inicial |
| Meta rejeitar anúncios de hospedagem | Baixo | Seguir políticas de ads de turismo; evitar claims exagerados |
| Budget insuficiente para resultados relevantes | Médio | Concentrar em 1-2 campanhas inicialmente; escalar ao comprovar ROAS |

---

## Dependencies

**Depends on:**
- EPIC-PLU-01 (Funil WhatsApp) — anúncios devem direcionar para WhatsApp com link direto
- Acesso ao site da pousada para GTM

**Blocks:**
- EPIC-PLU-05 (Analytics) — dados de ads alimentam o dashboard geral

---

## Documentation

| Type | Location | Status |
|------|----------|--------|
| Project Brief | docs/brief.md | ✅ Done |
| Estratégia de Audiências | docs/architecture/ads-audiences.md | Pending |
| Calendário de Criativos | docs/guides/creative-calendar.md | Pending |

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-22 | 1.0 | Epic criado via *create-epic | Morgan (@pm) |
