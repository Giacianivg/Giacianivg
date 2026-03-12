# PLU-23 — Competitor Pricing: Scraping Apify + Overlay calendar.html

**Epic:** EPIC-PLU-18 Revenue Intelligence (DEC-018)
**Status:** InReview
**Points:** 13
**Priority:** Alta (P1)
**Created:** 2026-03-12
**Author:** Morgan (@pm)
**Depende de:** PLU-22 (migration 013 deve estar aplicada)

---

## Description

Hoje a Pousada Luz da Lua ajusta preços sem saber o que a concorrência cobra.
Esta story implementa inteligência de preços regional:

1. Tabela `competitor_prices` no Supabase (migration 014)
2. Scraper via Apify que busca preços de 10 concorrentes em Socorro/Serra Negra/Lindóia
3. Cron job Vercel (00h diário) que executa o scraping automaticamente
4. Overlay no `calendar.html`: seu preço | média regional | por concorrente | diff%
5. Interface manual de fallback (para quando Apify falha)

Concorrentes confirmados (N1): 10 pousadas Booking.com (ver DEC-018).

---

## Acceptance Criteria

### AC-1: Migration 014 — tabela competitor_prices
**Given** migration 014 é executada
**When** consulta ao schema
**Then** tabela `competitor_prices` existe com colunas: id, competitor_name, competitor_url, platform, date, price, room_type, availability, scraped_at, source

### AC-2: Scraper Apify executa para todos os 10 concorrentes
**Given** lista de concorrentes está configurada em `services/competitor/competitors.js`
**When** função `runDailyScrape()` é chamada
**Then** chama Apify para cada URL de concorrente
**And** parseia preços por tipo de quarto (standard, casal, familia, grupo)
**And** salva resultados em `competitor_prices` com source='apify'
**And** retorna relatório: { scraped: N, failed: N, errors: [...] }

### AC-3: Cron job Vercel 00h diário
**Given** vercel.json tem cron configurado
**When** 00:00 UTC diariamente
**Then** GET /api/cron/competitor-prices é chamado
**And** executa scraping de todos os concorrentes
**And** responde { ok: true, report: {...} }

### AC-4: API de consulta de preços
**Given** existem preços scrapeados para o período
**When** GET /api/competitor-prices?from=YYYY-MM-DD&to=YYYY-MM-DD
**Then** retorna preços agrupados por data e concorrente
**And** GET /api/competitor-prices/summary?date=YYYY-MM-DD retorna: { nossa_media, media_regional, min, max, diff_pct, concorrentes: [...] }

### AC-5: Overlay no calendar.html
**Given** preços de concorrentes existem para o mês visualizado
**When** calendário é carregado
**Then** cada célula de dia mostra (se hover ou toggle ativo): nosso preço médio, média regional, lista de concorrentes com preços
**And** células com diff > +15% da média aparecem com badge vermelho (⚠ caro)
**And** células com diff < -15% aparecem com badge verde (🟢 competitivo)

### AC-6: Alertas automáticos no dashboard
**Given** cron executou scraping
**When** detecta anomalia (concorrente baixou >10%, você >20% acima da média)
**Then** insere alerta em tabela `alerts` com tipo 'competitor_price'
**And** alerta aparece no command-center.html

### AC-7: Fallback manual via API
**Given** Apify falhou para um concorrente
**When** POST /api/competitor-prices com { competitor_name, date, price, room_type }
**Then** insere com source='manual'
**And** dados manuais são usados normalmente no overlay

---

## Scope

**IN:**
- `database/migrations/014_competitor_prices.sql`
- `services/competitor/competitors.js` — lista dos 10 concorrentes
- `services/competitor/scraper.js` — integração Apify + parse + save
- `routes/competitor-prices.js` — GET lista, GET summary, POST manual
- `api/cron/competitor-prices.js` — endpoint cron (Vercel)
- `vercel.json` — adicionar cron entry (requer aprovação CTO)
- `server.js` — montar /api/competitor-prices (1 linha, requer aprovação CTO)
- `public/calendar.html` — adicionar overlay de preços de concorrentes

**OUT:**
- Sugestão automática de preço (PLU-24 / @revenue-agent)
- Email de alertas
- Scraping de Airbnb (fase 2 — apenas Booking.com agora)
- Histórico de mais de 90 dias

---

## Technical Notes

### Migration 014
```sql
CREATE TABLE competitor_prices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_name text NOT NULL,
  competitor_url text,
  platform text DEFAULT 'booking'
    CHECK (platform IN ('booking', 'airbnb', 'direct')),
  date date NOT NULL,
  price numeric(10,2),
  room_type text CHECK (room_type IN ('standard','casal','familia','grupo')),
  availability boolean DEFAULT true,
  scraped_at timestamptz DEFAULT now(),
  source text DEFAULT 'apify' CHECK (source IN ('apify', 'manual'))
);
CREATE INDEX idx_cp_date ON competitor_prices(date);
CREATE INDEX idx_cp_competitor_date ON competitor_prices(competitor_name, date);
```

### Lista de concorrentes (competitors.js)
```javascript
module.exports = [
  { name: 'Pousada Pompeia', url: 'https://www.booking.com/hotel/br/pousada-pompeia.html' },
  { name: 'Pousada Gruta do Anjo', url: 'https://www.booking.com/hotel/br/pousada-gruta-do-anjo.html' },
  { name: 'Pousada Recanto do Amanhecer', url: 'https://www.booking.com/hotel/br/pousada-recanto-do-amanhecer.html' },
  { name: 'Pousada Vale das Orquídeas', url: 'https://www.booking.com/hotel/br/vale-das-orquideas-pousada-socorro.html' },
  { name: 'Pousada Encantos de Socorro', url: 'https://www.booking.com/hotel/br/pousada-encantos-de-socorro.html' },
  { name: 'Pousada Pitauá', url: 'https://www.booking.com/hotel/br/pousada-pitua.html' },
  { name: 'Pousada Igarapé', url: 'https://www.booking.com/hotel/br/pousada-igarape.html' },
  { name: 'Pousada Villa dos Leais', url: 'https://www.booking.com/hotel/br/pousada-villa-dos-leais.html' },
  { name: 'Chalés Encantos da Serra', url: 'https://www.booking.com/hotel/br/chales-encantos-da-serra.html' },
  { name: 'Pousada Nefelibatas', url: 'https://www.booking.com/hotel/br/pousada-nefelibatas.html' },
];
```

### Apify Actor
Usar `apify/booking-scraper` ou ator compatível.
Parâmetros: checkIn, checkOut, rooms=1, adults=2, currency=BRL.
Se ator falhar → log error, continue para próximo.

### server.js — 1 linha a adicionar (aprovação CTO)
```javascript
app.use('/api/competitor-prices', require('./routes/competitor-prices'));
```

### vercel.json cron a adicionar (aprovação CTO)
```json
{ "path": "/api/cron/competitor-prices", "schedule": "0 3 * * *" }
```
(03h UTC = 00h horário de Brasília)

---

## File List

- [x] `database/migrations/014_competitor_prices.sql`
- [x] `services/competitor/competitors.js`
- [x] `services/competitor/scraper.js`
- [x] `routes/competitor-prices.js`
- [x] `vercel.json` — cron "0 3 * * *" adicionado (aprovação CTO confirmada por Vitor)
- [x] `server.js` — /api/competitor-prices + /api/cron/competitor-prices montados
- [x] `public/calendar.html` — overlay de preços de concorrentes (toggle 💰 Concorrentes)

---

## Tests

- [x] `tests/competitor/scraper.test.js` — 47 testes: parsePrice, normalizeDate, mapRoomType, getSeasonPrice, addDaysISO, parsePriceData, generateMockPrices
- [x] `tests/competitor/competitor-prices.route.test.js` — 33 testes: validação params GET/summary/POST, computeSummary

---

## Change Log

| Data | Autor | Ação |
|------|-------|------|
| 2026-03-12 | Morgan @pm | Story criada — Status: Ready |
| 2026-03-12 | Dex @dev | Implementação completa (migration + scraper + rotas + cron + overlay) — 259/259 testes — Status: InReview |
