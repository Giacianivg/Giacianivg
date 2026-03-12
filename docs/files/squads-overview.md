# ✍️ Copy Squad

> Responsável por toda comunicação escrita que converte.  
> Reporta ao CMO Agent.

---

## Agentes

### Copy Chief
**Função:** Estratégia de mensagem e posicionamento da pousada.
**Responsabilidade:** Voz da marca, aprovação de textos finais

### Landing Page Writer
**Função:** Textos de páginas que convertem visitantes em leads.
**Usa:** `public/*.html` (estrutura existente)

### Ads Copywriter
**Função:** Textos de anúncios para Meta Ads e Google Ads.
**Usa:** `agents/ads-agent.md`

### Email/WA Copywriter
**Função:** Mensagens de follow-up e nurturing via WhatsApp.
**Usa:** `services/follow-up/templates/`, tom da Luna

---

## Tom de Voz — Pousada Luz da Lua

```
✅ Usar:                         ❌ Evitar:
- Aconchegante, íntimo           - Corporativo, frio
- Escapada, descanso             - Hotel, estabelecimento
- Momentos especiais             - Produto, serviço
- Natureza, serenidade           - Instalações, comodidades
- Você merece                    - Oferecemos, dispomos
```

---

## Templates Base

### Anúncio Casal — Feriado
```
Headline: Sua escapada perfeita está esperando 💑
Body: [X] noites na Pousada Luz da Lua, no coração do 
Circuito das Águas. Café da manhã incluso, natureza em 
volta e o silêncio que vocês dois merecem.
CTA: Garanta sua data →
```

### Anúncio Família — Férias
```
Headline: As férias que toda família merece 🌿
Body: Natureza, tranquilidade e memórias que ficam. 
Em Socorro, a [X] horas de você. Quartos espaçosos, 
café farto e um lugar para descansar de verdade.
CTA: Ver disponibilidade →
```

---
---

# 🛍️ Product Squad

> Responsável pelo produto digital e experiência do usuário.  
> Reporta ao CPO Agent.

---

## Agentes

### Product Manager (@pm)
**Função:** Visão do produto, métricas e alinhamento estratégico.
**Usa:** `docs/prd/`, `docs/stories/epics/`

### Product Owner (@po)
**Função:** Backlog, critérios de aceitação, priorização de sprint.
**Usa:** `docs/stories/` (padrão PLU-XX / UX-XX existente)

### Scrum Master (@sm)
**Função:** Processo de desenvolvimento, remoção de bloqueios.
**Coordena:** Engineering Squad + Product Squad

### UX Design Expert
**Função:** Experiência do usuário, fluxos, protótipos.
**Usa:** `public/design-system/` (c.css, l.css, t.css, u.js)
**Referência:** `docs/architecture/` (UX reviews existentes)

### Analyst
**Função:** Dados de comportamento, insights de uso, relatórios.
**Usa:** `services/analytics/funnel-analytics.js`

---

## Padrão de User Story (existente no projeto)

```markdown
# [PLU-XX ou UX-XX] — Título da Story

**Epic:** [EPIC-XX]
**Como** [perfil de usuário],
**Quero** [ação ou funcionalidade],
**Para que** [benefício ou resultado].

## Critérios de Aceitação
- [ ] Critério 1
- [ ] Critério 2

## Notas Técnicas
- [considerações de implementação]
```

---
---

# ⚙️ Engineering Squad

> Responsável por toda implementação técnica.  
> Reporta ao CTO Agent.

---

## Agentes

### Architect (@architect)
**Função:** Decisões de arquitetura, padrões, revisão de código crítico.
**Referência:** `docs/architecture/`

### Developer (@dev)
**Função:** Implementação de features e correção de bugs.
**Stack:** Node.js, Express, Supabase, HTML/CSS/JS
**Segue:** Padrões de `routes/` e `services/` existentes

### DevOps (@devops)
**Função:** Deploy, infraestrutura, variáveis de ambiente.
**Usa:** `vercel.json`, `.env`, Supabase dashboard

### QA (@qa)
**Função:** Testes, validação, prevenção de regressão.
**Usa:** `tests/` (8 arquivos existentes)

### Data Engineer (@data-eng)
**Função:** Banco de dados, migrations, Google Sheets.
**Usa:** `database/migrations/`, `database/sheets.js`, `services/supabase/`

---

## Regras de Desenvolvimento (nunca violar)

```
1. Nova tabela → nova migration numerada (007+)
2. Mudança no webhook → testar antes de PR
3. Mudança na Luna → revisão obrigatória do CPO
4. Deploy → sempre via Vercel CLI, nunca manual
5. .env → NUNCA commitar, verificar .gitignore
```

---
---

# 💰 Revenue Squad

> Responsável por análise financeira e otimização de receita.  
> Reporta ao CFO Agent.

---

## Agentes

### Analytics Agent
**Função:** Relatórios de receita, ocupação e tendências.
**Usa:** `services/analytics/revenue-analytics.js`
**Entrega:** Relatório semanal para CFO e CEO

### Forecast Agent
**Função:** Previsão de receita e ocupação para 30–60 dias.
**Usa:** `ai-os/data/demand-prediction.md` + histórico de reservas
**Integra:** `services/analytics/revenue-analytics.js`

### Pricing Optimizer
**Função:** Recomendações de preço dinâmico.
**Segue:** `ai-os/data/revenue-optimization.md`
**Aplica em:** `services/quotation/engine.js`

---

## Relatório Semanal — Template

```
📊 Revenue Report — [SEMANA]

Ocupação atual: XX%
Receita da semana: R$ X.XXX
Ticket médio: R$ X.XXX
RevPAR: R$ XXX
Desconto médio: X%

Vs. semana anterior: ▲/▼ X%
Vs. meta mensal: X% do objetivo

Previsão próximas 2 semanas:
→ Semana 1: XX% ocupação prevista
→ Semana 2: XX% ocupação prevista

Ação recomendada:
→ [sugestão do Revenue Engine]
```
