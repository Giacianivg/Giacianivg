# Project Brief: Pousada Luz da Lua

**Versão:** 1.0
**Data:** 2026-02-22
**Status:** Draft
**Autor:** Orion (AIOS Master) via *init-project

---

## Executive Summary

A **Pousada Luz da Lua**, localizada em Socorro-SP, opera no modelo de hospedagem combinada com eventos e grupos. O projeto tem como objetivo alcançar **lotação máxima anual com previsibilidade de receita**, atingindo **R$100.000/mês com margem mínima de 35%** através da orquestração inteligente de marketing digital, automação de vendas, pricing dinâmico e estratégias de retenção de hóspedes.

A solução utilizará AIOS + Claude como motor de IA, integrado com Meta Ads, Google Ads e WhatsApp Business para criar um ecossistema de crescimento previsível e escalável.

---

## Problem Statement

### Estado atual e dores
- Sazonalidade acentuada em destinos turísticos do interior de SP gera receita imprevisível
- Dependência de OTAs (Booking, Airbnb) corrói margem com comissões de 15-25%
- Falta de automação no atendimento e follow-up de leads resulta em perda de reservas
- Ausência de estratégia de pricing dinâmico deixa dinheiro na mesa em períodos de alta demanda
- Baixa taxa de retorno de hóspedes por ausência de programa de retenção estruturado

### Impacto do problema
- Receita abaixo do potencial em 40-60% dos meses do ano
- Margem comprimida por dependência excessiva de canais pagos (OTAs)
- Time operacional sobrecarregado com tarefas repetitivas que poderiam ser automatizadas

### Por que agora
- IA generativa viabilizou automação sofisticada a custo acessível
- Meta Ads e Google Ads oferecem targeting ultra-preciso para audiências de turismo
- WhatsApp Business API permite automação de atendimento 24/7

---

## Proposed Solution

Plataforma de **Growth Operations** para a Pousada Luz da Lua, composta por:

1. **Motor de Marketing Digital** — Campanhas automatizadas no Meta Ads e Google Ads com otimização contínua por IA
2. **Funil de Vendas Automatizado** — WhatsApp Business + Claude para qualificação, cotação e fechamento de reservas
3. **Pricing Dinâmico** — Algoritmo que ajusta tarifas com base em ocupação, sazonalidade e demanda
4. **Programa de Retenção** — CRM integrado com régua de comunicação personalizada por IA
5. **Dashboard de Receita** — Visibilidade em tempo real de ocupação, ARR e margem

### Diferenciais
- Automação com personalidade: Claude mantém tom humano e acolhedor no WhatsApp
- Pricing inteligente sem depender de OTAs como referência principal
- Loop de aprendizado contínuo: AIOS aprende com cada interação para melhorar conversões

---

## Target Users

### Segmento Primário: Hóspedes Individuais e Casais
- **Perfil:** Adultos 28-55 anos, classe A/B, São Paulo e região
- **Comportamento:** Buscam escapadas de fim de semana, valorizam experiência e atenção personalizada
- **Necessidades:** Reserva fácil, comunicação ágil, custo-benefício transparente
- **Goals:** Descanso, reconexão, experiências únicas no interior

### Segmento Secundário: Grupos e Eventos
- **Perfil:** Organizadores de eventos corporativos, retiros, celebrações (casamentos, aniversários)
- **Comportamento:** Planejamento com 30-90 dias de antecedência, múltiplas cotações
- **Necessidades:** Capacidade para grupos, infraestrutura para eventos, orçamento detalhado
- **Goals:** Evento sem fricção, experiência memorável para convidados

---

## Goals & Success Metrics

### Business Objectives
- Atingir R$100.000/mês de receita bruta até o final do Quarter 3 de 2026
- Manter margem operacional mínima de 35% consistentemente
- Reduzir dependência de OTAs para <30% das reservas totais
- Atingir taxa de ocupação média anual de 75%+

### User Success Metrics
- Tempo médio de resposta a consultas: <5 minutos (WhatsApp automatizado)
- Taxa de conversão lead → reserva: >25%
- NPS de hóspedes: >70
- Taxa de retorno de hóspedes: >30% ao longo de 12 meses

### KPIs
- **RevPAR (Revenue per Available Room):** Meta R$250+/noite
- **Taxa de Ocupação:** 75% média anual
- **CAC (Custo de Aquisição de Cliente):** <R$150
- **LTV (Lifetime Value):** >R$1.500 por hóspede
- **Margem EBITDA:** ≥35%
- **Percentual de Reservas Diretas:** >70%

---

## MVP Scope

### Core Features (Must Have)
- **Funil WhatsApp Automatizado:** Recepção de leads, qualificação, cotação e fechamento via Claude + WhatsApp Business API
- **Calendário de Ocupação com Pricing Dinâmico:** Sistema simples de tarifas por período (alta/baixa/média temporada) com ajuste manual
- **Campanhas Meta Ads estruturadas:** 2-3 campanhas ativas (awareness + conversão) para cada segmento principal
- **CRM básico de hóspedes:** Registro de histórico, preferências e régua de reativação pós-hospedagem
- **Dashboard de métricas:** Ocupação, receita, margem e origem das reservas em visão semanal

### Out of Scope para MVP
- App mobile proprietário
- Sistema de check-in/check-out digital
- Integração com channel managers (exceto via API básica do Booking)
- Motor de IA para precificação preditiva complexa (fase 2)
- Programa de fidelidade com pontos

### MVP Success Criteria
MVP considerado bem-sucedido quando a pousada atingir R$60.000/mês de receita com >50% de reservas diretas e NPS>60, sustentado por 2 meses consecutivos.

---

## Post-MVP Vision

### Phase 2 Features
- Pricing preditivo com ML baseado em histórico e dados de mercado
- Integração bidirecional com channel managers (Stays, Omnibees)
- App de hóspede com check-in digital, cardápio e solicitações
- Programa de fidelidade estruturado com benefícios por nível

### Long-term Vision (12-24 meses)
Pousada Luz da Lua como referência em experiência digitalizada no circuito turístico Circuito das Águas Paulista/Socorro-SP, com modelo replicável para expansão a outras unidades ou licenciamento do playbook para outras pousadas.

### Expansion Opportunities
- Consultoria/franquia do modelo operacional para outras pousadas da região
- Plataforma SaaS "Pousada OS" para pequenos meios de hospedagem

---

## Technical Considerations

### Platform Requirements
- **Canais Primários:** WhatsApp Business (mobile + web), Meta Ads Manager, Google Ads
- **Automação:** Claude API (Anthropic) para processamento de linguagem natural
- **CRM:** Notion ou Airtable como base de dados inicial (simples, baixo custo)
- **Dashboard:** Metabase ou Google Looker Studio (gratuito)

### Technology Preferences
- **IA/Automação:** Claude Sonnet 4.6 via Anthropic API
- **Messaging:** WhatsApp Business API (Meta) + Make.com ou n8n para orquestração
- **Ads:** Meta Ads Manager + Google Ads (controle manual + regras automatizadas)
- **CRM/Database:** Airtable (flexível, sem código) ou Notion
- **Analytics:** Google Analytics 4 + Looker Studio
- **Hosting:** Vercel ou Railway para webhooks e serviços leves

### Architecture Considerations
- **Arquitetura:** Event-driven via webhooks (WhatsApp → Make.com → Claude → WhatsApp)
- **Integrações:** WhatsApp Business API, Anthropic API, Meta Marketing API, Google Ads API
- **Segurança:** LGPD compliance para dados de hóspedes, criptografia em trânsito

---

## Constraints & Assumptions

### Constraints
- **Budget de Marketing:** A definir (estimativa inicial R$5.000-10.000/mês para ads)
- **Timeline:** MVP operacional em 60-90 dias
- **Recursos:** Equipe enxuta (1-2 pessoas operacionais + AIOS como copiloto)
- **Técnico:** Sem equipe de dev dedicada — soluções no-code/low-code priorizadas

### Key Assumptions
- A pousada tem capacidade física e operacional para suportar 75%+ de ocupação
- WhatsApp é o canal de comunicação preferido do público-alvo
- O mercado de Socorro-SP tem demanda reprimida que pode ser capturada com marketing digital
- Claude consegue manter qualidade de atendimento aceitável sem supervisão humana em >80% das interações

---

## Risks & Open Questions

### Key Risks
- **Sazonalidade extrema:** Socorro-SP pode ter picos e vales muito acentuados que dificultem metas mensais consistentes
- **Dependência de plataformas:** Mudanças no algoritmo do Meta Ads ou regras do WhatsApp Business podem impactar funil
- **Qualidade da IA:** Claude pode gerar respostas inadequadas em situações não mapeadas, prejudicando experiência
- **Concorrência:** Outras pousadas da região podem adotar estratégias similares

### Open Questions
- Qual a capacidade atual de quartos/chalés da pousada?
- Existe website/booking engine próprio ou apenas OTAs?
- Qual o histórico de receita dos últimos 12 meses?
- Há equipe dedicada para marketing ou é operação do próprio dono?
- Qual o ticket médio atual por reserva?
- A pousada já tem conta WhatsApp Business configurada?

### Areas Needing Further Research
- Análise competitiva de pousadas em Socorro-SP e região (pricing, posicionamento)
- Benchmarks de CAC e LTV para segmento de pousadas boutique no interior paulista
- Melhores práticas de automação WhatsApp para hotelaria
- Regulamentação LGPD aplicada ao setor hoteleiro

---

## Next Steps

### Immediate Actions
1. **@pm *create-epic** — Criar Épico Principal: "Growth Operations Engine"
2. **@analyst** — Pesquisa competitiva: pousadas Socorro-SP, pricing de mercado
3. **@architect** — Mapear arquitetura de integração: WhatsApp Business API + Claude + Make.com
4. Responder Open Questions com dados reais da operação atual

### PM Handoff
Este Project Brief fornece o contexto completo para a **Pousada Luz da Lua**. Próximo passo: `@pm *create-epic` para estruturar os épicos de desenvolvimento. O @pm deve revisar este brief, validar as metas de R$100k/mês com 35% de margem e criar épicos para cada domínio do escopo (Marketing, Vendas/Automação, Pricing, Retenção, Analytics).
