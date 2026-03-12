# PLU-24 — @revenue-agent Maxwell: Revenue Manager Automático

**Epic:** EPIC-PLU-18 Revenue Intelligence (DEC-018)
**Status:** InReview
**Points:** 8
**Priority:** Alta (P1)
**Created:** 2026-03-12
**Author:** Morgan (@pm)
**Depende de:** PLU-23 (tabela competitor_prices deve estar populada)

---

## Description

Com preços de concorrentes no banco (PLU-23), precisamos de um agente que interprete
esses dados e gere inteligência acionável — não apenas dados brutos.

Maxwell (@revenue-agent) é o Revenue Manager virtual da Pousada Luz da Lua:
- Referência: Revenue Manager de rede hoteleira 4 estrelas
- Monitora preços da região diariamente (consome competitor_prices)
- Detecta padrões: alta demanda, feriados, concorrente movendo preço
- Gera alertas acionáveis no dashboard e WhatsApp equipe
- Sugere preço ideal com justificativa e confiança

Maxwell NUNCA altera preços diretamente. Sugere → Vitor aprova.

---

## Acceptance Criteria

### AC-1: Arquivo de definição do agente
**Given** arquivo `ai-os/agents/revenue-agent.md` criado
**When** qualquer agente invoca @revenue-agent
**Then** persona Maxwell é adotada com escopo de revenue management
**And** ferramentas permitidas e proibidas estão documentadas

### AC-2: Análise de posicionamento competitivo
**Given** competitor_prices tem dados para os próximos 14 dias
**When** Maxwell executa `analyzeCompetitorPricing(date, roomType)`
**Then** retorna: { nossa_preco, media_regional, diff_pct, position: 'acima'|'abaixo'|'alinhado', recommendation }

### AC-3: Detecção de sinais de demanda
**Given** dados de reservas + competitor_prices + calendário de feriados
**When** Maxwell executa `detectDemandSignals(from, to)`
**Then** identifica períodos com ocupação regional alta (>70% estimado)
**And** identifica quando concorrente subiu ou baixou preço >10% em 24h

### AC-4: Geração de alertas
**Given** Maxwell detectou anomalia (você caro, concorrente moveu, alta demanda)
**When** alerta é gerado
**Then** é inserido em tabela `alerts` com categoria 'revenue' e dados estruturados
**And** aparece no command-center.html com ação sugerida
**And** formatos de alerta corretos:
  - "⚠️ Você está 23% mais caro que a média regional no fim de semana de 22/mar"
  - "📉 Pousada Pompeia baixou preço: R$350→R$280 (hoje)"
  - "🔥 Alta demanda prevista: Páscoa — ocupação regional estimada 85%"

### AC-5: Sugestão de preço com justificativa
**Given** Maxwell analisa data específica e tipo de quarto
**When** função `suggestPrice(date, roomType)` é chamada
**Then** retorna: { suggested_price, current_price, delta, reason, confidence_pct }
**And** reason é texto legível: "Concorrentes médios R$305 + ocupação regional 78% + feriado"

### AC-6: Integração com command-center.html
**Given** Maxwell gerou pelo menos 1 alerta de revenue
**When** gestor abre command-center.html
**Then** seção "Revenue Intelligence" exibe alertas com badge de urgência
**And** botão "Ver detalhes" abre preços do calendário na data relevante

---

## Scope

**IN:**
- `ai-os/agents/revenue-agent.md` — definição do agente Maxwell
- `services/revenue-intelligence/revenue-agent.js` — lógica principal
- `services/revenue-intelligence/demand-signals.js` — detecção de padrões
- `services/revenue-intelligence/alert-generator.js` — formatação e inserção de alertas
- Integração com `command-center.html` (widget de Revenue Intelligence)
- Chamada automática após cron de scraping (PLU-23)

**OUT:**
- Execução automática de mudança de preços (DEC-019)
- Envio automático via WhatsApp (DEC-019 — por ora só dashboard)
- ML/embeddings para previsão (pgvector — DEC-016)
- Integração com sistema de cotação Luna (requer N2 aprovação)

---

## Technical Notes

### revenue-agent.js — estrutura de funções
```javascript
async function analyzeCompetitorPricing(date, roomType) { ... }
async function detectDemandSignals(from, to) { ... }
async function suggestPrice(date, roomType) { ... }
async function generateDailyReport() { ... } // chamado após cron PLU-23
async function insertAlert(type, data) { ... } // salva em tabela alerts
```

### Lógica de sugestão de preço
```
suggested = media_regional * fator_sazonalidade * fator_ocupacao
onde:
  fator_sazonalidade: alta=1.3, media=1.1, baixa=1.0
  fator_ocupacao: >80%=1.2, >60%=1.1, <40%=0.9
confidence_pct: baseado em N amostras (10 concorrentes = alta confiança)
```

### Alert types na tabela alerts
```
tipo: 'competitor_price_drop' | 'competitor_price_surge'
      'you_expensive' | 'you_cheap_opportunity'
      'high_demand_signal' | 'low_season_warning'
```

### ai-os/agents/revenue-agent.md — campos obrigatórios
```yaml
id: revenue-agent
name: Maxwell
persona: Revenue Manager de rede hoteleira
tools_allowed: [SELECT competitor_prices, SELECT reservations, INSERT alerts]
tools_blocked: [UPDATE reservations, UPDATE rooms, git push, webhook]
escalates_to: Founder (Vitor) via dashboard
never_does: alterar preços diretamente
```

---

## File List

- [x] `ai-os/agents/revenue-agent.md` — persona Maxwell completa
- [x] `database/migrations/015_revenue_alerts.sql` — tabela revenue_alerts + índices
- [x] `services/revenue-intelligence/revenue-agent.js` — analyzeCompetitorPricing, detectDemandSignals, suggestPrice, generateDailyReport
- [x] `services/revenue-intelligence/demand-signals.js` — funções puras de análise (getSeason, detectPriceChanges, computePricePosition, computeSuggestedPrice)
- [x] `services/revenue-intelligence/alert-generator.js` — insertAlert, getActiveRevenueAlerts, dismissAlert, dedup diário
- [x] `routes/alerts.js` — GET /api/alerts/revenue, PATCH /api/alerts/revenue/:id/dismiss
- [x] `server.js` — generateDailyReport chamado após cron PLU-23
- [x] `public/command-center.html` — widget "💹 Revenue Intelligence — Maxwell"

---

## Tests

- [x] `tests/revenue/revenue-agent.test.js` — OWN_PRICES, getOwnPrice (14 testes)
- [x] `tests/revenue/demand-signals.test.js` — getSeason, events, detectPriceChanges, computePricePosition, computeSuggestedPrice (38 testes)

---

## Change Log

| Data | Autor | Ação |
|------|-------|------|
| 2026-03-12 | Morgan @pm | Story criada — Status: Ready |
| 2026-03-12 | Dex @dev | Implementação completa — Maxwell agent + demand signals + alert-generator + widget command-center — 311/311 testes — Status: InReview |
