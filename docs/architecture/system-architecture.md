# Pousada Luz da Lua — Arquitetura do Sistema

**Versão:** 1.0
**Data:** 2026-02-23
**Autor:** Aria (@architect) — Brownfield Discovery Fase 1
**Story de Referência:** PLU-01.1, PLU-01.2
**Status:** Estado atual (não aspiracional)

---

## Change Log

| Data       | Versão | Descrição                                  | Autor             |
|------------|--------|--------------------------------------------|-------------------|
| 2026-02-23 | 1.0    | Documento inicial — Brownfield Discovery   | Aria (@architect) |

---

## Introdução

Este documento captura o **estado ATUAL** da plataforma de Growth Operations da Pousada Luz da Lua, incluindo o que foi implementado, o que está pendente de ação humana, débitos técnicos e restrições de integração. Serve como referência para agentes de IA trabalhando nas próximas stories.

### Contexto do Projeto

- **Negócio:** Pousada Luz da Lua — hospedagem + eventos em Socorro-SP
- **Meta:** R$100.000/mês com margem ≥ 35%
- **Modelo técnico:** No-code/low-code + microserviço de webhook
- **Restrição crítica:** Sem equipe de dev dedicada — soluções no-code/low-code priorizadas
- **MVP Target:** 60-90 dias

---

## Quick Reference — Arquivos-Chave

| Propósito | Arquivo |
|-----------|---------|
| Webhook handler principal | `src/webhook/handler.js` |
| Variáveis de ambiente | `src/webhook/.env.example` |
| Deploy config (Vercel) | `src/webhook/vercel.json` |
| System prompt da "Luna" (Claude) | `docs/architecture/claude-system-prompt.md` |
| Schema Airtable | `docs/architecture/airtable-schema.md` |
| Migração WhatsApp | `docs/architecture/whatsapp-migration.md` |
| Blueprint Make.com (atendimento) | `docs/make-com/blueprint-pousada-atendimento.json` |
| Blueprint Make.com (follow-up) | `docs/make-com/blueprint-pousada-followup.json` |
| Testes do system prompt | `src/chatbot/test-system-prompt.js` |
| Relatórios de QA | `docs/qa/system-prompt-test-*.json` |
| Brief do projeto | `docs/brief.md` |
| Épicos | `docs/stories/epics/EPIC-INDEX.md` |

---

## Arquitetura de Alto Nível

### Fluxo Principal (Atendimento WhatsApp)

```
Hóspede (WhatsApp)
  │
  │  mensagem de texto
  ▼
Meta Cloud API (WhatsApp Business API)
  │
  │  POST /webhook  (≤5s para 200 OK — requisito crítico)
  ▼
Vercel (src/webhook/handler.js)
  │  200 OK imediato ←── CRÍTICO: evita retry/bloqueio da Meta
  │
  │  forward async JSON payload
  ▼
Make.com (orquestrador de cenários)
  ├──► Airtable (busca histórico / registra conversa)
  ├──► Anthropic API ou DeepSeek (chatbot "Luna")
  └──► Meta Cloud API (envia resposta ao hóspede)
```

### Fluxo Secundário (Follow-up pós-cotação)

```
Airtable (Watch Records trigger)
  │  Filtro: Status="Cotação enviada" AND Follow-up=FALSE AND tempo>2h
  ▼
Make.com (cenário follow-up)
  └──► Meta Cloud API (envia follow-up ao hóspede)
       └──► Airtable (marca Follow-up=TRUE)
```

---

## Stack Tecnológico Real

### Camada de Código (gerenciado)

| Categoria | Tecnologia | Versão | Notas |
|-----------|-----------|--------|-------|
| Runtime | Node.js | ≥18.0.0 | Exigido pelo handler |
| Framework HTTP | Express | ^4.18.3 | Webhook handler only |
| Config | dotenv | ^16.4.5 | Env vars |
| Linting | ESLint | ^8.57.0 | Dev only |
| Deploy | Vercel | — | Serverless, Hobby (R$0) |

### Serviços Externos (no-code / SaaS)

| Serviço | Propósito | Custo/mês | Status |
|---------|-----------|-----------|--------|
| Meta Cloud API (WhatsApp) | Canal de comunicação | R$0-50 (conv. volume) | Pendente migração |
| Make.com Core | Orquestração de fluxos | ~$9 (~R$50) | Pendente setup |
| Anthropic API (Claude Sonnet 4.6) | IA principal / cotação | ~$7.50 (1k conv) | Credencial OK |
| DeepSeek API | IA auxiliar / FAQs simples | ~$1-2 (estimativa) | Documentado, não impl. |
| Airtable | CRM / dados operacionais | Grátis (MVP) | Pendente criação |
| Vercel Hobby | Webhook hosting | R$0 | Implementado |
| Google Analytics 4 | Web analytics | R$0 | Não iniciado |
| Meta Ads Manager | Performance marketing | Budget variável | Não iniciado (EPIC-02) |

---

## Estrutura de Diretórios

```
meu-projeto/
├── src/
│   ├── webhook/                    # Microserviço de webhook (Node.js)
│   │   ├── handler.js              # Handler principal (ENTRY POINT)
│   │   ├── package.json
│   │   ├── vercel.json             # Config de deploy
│   │   ├── .env.example            # Template de variáveis
│   │   ├── node_modules/           # Dependências instaladas
│   │   └── tests/
│   │       └── handler.test.js     # 7 testes unitários (node:test nativo)
│   └── chatbot/                    # Módulo de testes do chatbot
│       ├── test-system-prompt.js   # 32 testes automatizados
│       └── package.json
├── docs/
│   ├── brief.md                    # Project brief completo
│   ├── architecture/
│   │   ├── system-architecture.md  # ESTE ARQUIVO
│   │   ├── claude-system-prompt.md # System prompt da "Luna"
│   │   ├── airtable-schema.md      # Schema completo do CRM
│   │   ├── whatsapp-migration.md   # Guia de migração WhatsApp
│   │   └── room-categories.md      # Categorias de quartos
│   ├── stories/
│   │   ├── epics/
│   │   │   ├── EPIC-INDEX.md       # Índice dos 5 épicos
│   │   │   ├── EPIC-PLU-01-*.md    # Funil de Vendas
│   │   │   ├── EPIC-PLU-02-*.md    # Marketing Digital
│   │   │   ├── EPIC-PLU-03-*.md    # Pricing Dinâmico
│   │   │   ├── EPIC-PLU-04-*.md    # CRM e Retenção
│   │   │   └── EPIC-PLU-05-*.md    # Analytics
│   │   ├── PLU-01.1.story.md       # InProgress (webhook)
│   │   ├── PLU-01.2.story.md       # InProgress (chatbot base)
│   │   └── PLU-01.3.story.md       # Pending (fluxo completo)
│   ├── make-com/
│   │   ├── SETUP.md
│   │   ├── blueprint-pousada-atendimento.json
│   │   └── blueprint-pousada-followup.json
│   └── qa/
│       ├── system-prompt-test-*.json   # Relatórios de teste gerados
│       └── (coderabbit-reports/ — futuro)
└── .aios-core/                     # Framework AIOS (não modificar)
```

---

## Componente: Webhook Handler (`src/webhook/handler.js`)

### Responsabilidades
- Verificação do webhook (GET `/webhook` — challenge Meta)
- Recebimento de mensagens (POST `/webhook`)
- Health check (GET `/health`)
- Forward assíncrono para Make.com

### Padrão Crítico
```javascript
// NUNCA fazer processamento pesado antes de responder 200
app.post('/webhook', (req, res) => {
  res.sendStatus(200); // Resposta imediata — REQUISITO META
  processAsync(req.body); // Processamento assíncrono depois
});
```

> ⚠️ **GOTCHA:** Se o handler não responder 200 em ≤5s, a Meta vai reenviar a mensagem e potencialmente bloquear o número.

### Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `WHATSAPP_PHONE_NUMBER_ID` | Sim | ID do número na Meta API |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Sim | ID da conta WhatsApp Business |
| `WHATSAPP_ACCESS_TOKEN` | Sim | System User Token (não expira) |
| `WHATSAPP_VERIFY_TOKEN` | Sim | Token de verificação do webhook (escolhido por nós) |
| `WEBHOOK_URL` | Sim | URL pública Vercel após deploy |
| `MAKE_WEBHOOK_URL` | Sim | URL do webhook receptor no Make.com |

### Estado Atual
- ✅ Implementado e testado (7/7 testes unitários OK)
- ✅ Deploy config pronto (vercel.json)
- ⏳ URL ainda não registrada no Meta Developers Portal (aguarda deploy + T4.3)
- ⏳ Número (19) 99840-0306 ainda no WhatsApp Business App (aguarda migração)

---

## Componente: Make.com (Orquestrador)

### Cenários Planejados

| Cenário | Trigger | Status |
|---------|---------|--------|
| `Pousada - Atendimento WhatsApp` | Webhook (msg recebida) | Não configurado |
| `Pousada - Follow-up pós-cotação` | Airtable Watch Records | Não configurado |

### Blueprints Documentados
- `docs/make-com/blueprint-pousada-atendimento.json`
- `docs/make-com/blueprint-pousada-followup.json`

### Roteamento por Modelo de IA (estratégia de custo)

```
Mensagem recebida
  │
  ├── SIMPLES (FAQs, saudações, localização)
  │     └──► DeepSeek API (custo ~70% menor)
  │
  └── COMPLEXO (cotação, reclamação, pedidos especiais)
        └──► Claude Sonnet 4.6 (Anthropic API)
```

> ⚠️ **NOTA:** O roteamento por modelo está documentado mas não implementado. Toda chamada ainda vai para Claude por padrão.

### Variáveis de Ambiente Make.com

Configurar em Make.com → Team → Variables:
- `ANTHROPIC_API_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `EQUIPE_WHATSAPP_NUMBER`
- `DEEPSEEK_API_KEY` (quando implementar roteamento)

---

## Componente: Claude "Luna" (Chatbot)

### Identidade
- **Nome:** Luna
- **Modelo:** claude-sonnet-4-6
- **Idioma:** Português brasileiro exclusivamente
- **Tom:** Acolhedor, caloroso, profissional (recepcionista experiente)

### Arquivo do System Prompt
`docs/architecture/claude-system-prompt.md`

### Sinais de Controle no Output do Claude

| Sinal | Quando | Ação no Make.com |
|-------|--------|-----------------|
| `[ESCALAR]` | Não sabe responder, pedido de humano, reclamação | Remove token, notifica equipe, envia msg de escalonamento |
| `[COTAR]` | Hóspede informa datas + nº pessoas + tipo quarto | Aciona fluxo de cotação automática (PLU-01.3) |

### Estado dos Testes
- ✅ 32/32 testes do system prompt passando
- ✅ Relatórios em `docs/qa/system-prompt-test-*.json`
- ⏳ Testes end-to-end no WhatsApp real (depende de PLU-01.1 concluída)

---

## Componente: Airtable (CRM)

### Base: "Pousada Luz da Lua — CRM"

| Tabela | Propósito |
|--------|-----------|
| `Conversas` | Histórico de leads e interações |
| `Disponibilidade` | Calendário de ocupação por tipo de quarto |
| `Tabela de Preços` | Tarifas por temporada e tipo de quarto |

> Schema completo em: `docs/architecture/airtable-schema.md`

### Estado Atual
- ⏳ Base ainda não criada (ação humana necessária — T4 da PLU-01.2)
- ✅ Schema documentado e validado
- ✅ Queries Make.com documentadas no schema

### Tipos de Quarto

| Código | Tipo | Capacidade | Preço base |
|--------|------|-----------|------------|
| `ALA_A` | Standard Casal | Até 3 pessoas | R$300/noite |
| `ALA_B` | Família | Até 5 pessoas | R$300-350/noite |
| `ALA_C_GRUPO` | Grupo | Até 8 pessoas | Sob consulta |
| `ALA_C_CASAL` | Casal especial | Até 2 pessoas | R$300/noite |

> ⚠️ Preços de alta temporada ainda indefinidos — aguardando pesquisa de concorrentes (EPIC-PLU-02).

---

## Integrações Externas

| Serviço | Tipo de Integração | Documentação | Status |
|---------|-------------------|-------------|--------|
| Meta Cloud API (WhatsApp) | REST API via webhook | `docs/architecture/whatsapp-migration.md` | Pendente migração |
| Anthropic API | REST via Make.com HTTP module | `docs/architecture/claude-system-prompt.md` | Credencial OK |
| DeepSeek API | REST via Make.com HTTP module | Referência em PLU-01.2 | Não implementado |
| Airtable | SDK oficial Make.com | `docs/architecture/airtable-schema.md` | Pendente criação |
| Vercel | Git-free deploy (vercel.json) | `src/webhook/vercel.json` | Pronto para deploy |

---

## Estado das Stories (Épico PLU-01)

### PLU-01.1 — Migração WhatsApp Business App → API
**Status:** 🔄 InProgress
**Implementado por código:** T4.1, T4.2 (webhook handler + testes), T6.1 (documentação)
**Pendente ação humana:**
- T1: Criar Meta Business Manager com CNPJ
- T2: Criar app no Meta Developers Portal, obter credenciais
- T3: Migrar número (19) 99840-0306 (downtime max 4h, fazer de madrugada)
- T4.3-T4.5: Registrar webhook URL, subscrever eventos, testar com mensagem real
- T5.1-T5.4: Criar e submeter 2 templates à Meta (aprovação: até 24h)
- T6.2-T6.4: Teste end-to-end e validação ACs

### PLU-01.2 — Integração Claude + Make.com (Chatbot Base)
**Status:** 🔄 InProgress
**Implementado:** T2.1-T2.4 (system prompt + 32 testes)
**Pendente ação humana:**
- T1: Criar conta Make.com (~$9/mês) e configurar conexões
- T3: Configurar cenário Make.com usando blueprints documentados
- T4: Criar base Airtable com schema documentado
- T5: Testes end-to-end (depende de PLU-01.1 concluída)

### PLU-01.3 — Fluxo Completo (Qualificação + Cotação + Follow-up)
**Status:** 📋 Pending
**Depende de:** PLU-01.1 + PLU-01.2 operacionais

---

## Débitos Técnicos Identificados

### Críticos (bloqueia funcionalidade)

| ID | Débito | Área | Impacto |
|----|--------|------|---------|
| DT-01 | Webhook URL não registrada no Meta | Infra | WhatsApp não funciona |
| DT-02 | Número não migrado para API | Infra | Automação impossível |
| DT-03 | Make.com não configurado | Integração | Fluxo completo inoperante |
| DT-04 | Airtable base inexistente | Dados | Sem CRM |

### Altos (impacto em qualidade/segurança)

| ID | Débito | Área | Impacto |
|----|--------|------|---------|
| DT-05 | Roteamento DeepSeek/Claude não implementado | Custo | Custo ~2x maior que estimado |
| DT-06 | Sem retry logic no forward para Make.com | Resiliência | Mensagens perdidas se Make.com offline |
| DT-07 | Sem rate limiting no webhook | Segurança | Vulnerável a flood/spam |
| DT-08 | Credenciais apenas em .env local | Segurança | Risco se .env vazar |
| DT-09 | Preços de alta temporada indefinidos | Negócio | Claude não consegue cotar períodos críticos |

### Médios (dívida técnica)

| ID | Débito | Área | Impacto |
|----|--------|------|---------|
| DT-10 | Sem observabilidade/logging estruturado | Ops | Difícil debugar em produção |
| DT-11 | Sem CI/CD pipeline | DevOps | Deploy manual |
| DT-12 | Sem monitoramento de uptime | Ops | Falhas silenciosas |
| DT-13 | Sem estratégia de backup Airtable | Dados | Risco de perda de dados |

---

## Constraints e Gotchas

### Meta / WhatsApp Business API
- **Timeout:** Webhook DEVE retornar 200 em ≤5s (handler já implementado corretamente)
- **Templates:** Mensagens outbound exigem template aprovado pela Meta (até 24h de aprovação)
- **Janela de 24h:** Após mensagem do usuário, a pousada tem 24h para responder livremente; depois só via template
- **Free tier:** 1.000 conversas inbound/mês gratuitas; acima: ~R$0,18/conversa
- **Rollback:** Reverter para WhatsApp Business App pode levar horas; equipe deve ser preparada

### Claude / Anthropic
- **[ESCALAR] / [COTAR]:** Sinais de controle devem ser tratados ANTES de enviar resposta ao hóspede
- **Tokens:** Sistema atual estimado em ~500 tokens/input + ~300 tokens/output por mensagem
- **Contexto:** Make.com passa últimas 5 mensagens como histórico — não há memória de longo prazo

### Make.com
- **Timeout:** Cenários têm limite de 30s por execução (configurar adequadamente)
- **Error handling:** Configurar fallback em TODOS os módulos (mensagem padrão ao hóspede em caso de falha)
- **Webhooks:** URL do webhook Make.com deve ser referenciada no handler Vercel (MAKE_WEBHOOK_URL)

### Airtable
- **Queries:** Filtros sensíveis a formato de data e case-sensitivity dos campos Single Select
- **API rate limit:** 5 requests/segundo por base (Make.com deve ter throttling configurado)
- **Fórmula Disponíveis:** Campo calculado — não pode ser escrito diretamente

### Vercel
- **Cold start:** Primeiras requisições após inatividade podem ter latência extra (~500ms)
- **Serverless limits:** Funções têm timeout de 10s no Hobby plan — adequado para o handler

---

## Desenvolvimento Local

### Setup do Webhook

```bash
cd src/webhook
npm install
cp .env.example .env
# Preencher .env com credenciais reais
npm run dev
```

### Executar Testes

```bash
cd src/webhook
npm test         # 7 testes unitários (handler)

cd src/chatbot
node test-system-prompt.js   # 32 testes do system prompt
```

### Deploy no Vercel

```bash
cd src/webhook
npx vercel --prod
# Copiar URL gerada → registrar no Meta Developers Portal → WhatsApp → Configuration → Webhook
```

---

## Roadmap de Épicos

| ID | Épico | Status | Impacto Estimado |
|----|-------|--------|-----------------|
| EPIC-PLU-01 | Funil de Vendas (WhatsApp + Claude) | 🔄 Planning/InProgress | +R$20-25k/mês |
| EPIC-PLU-02 | Motor de Marketing Digital (Meta Ads + Google) | 📋 Planning | +R$30-40k/mês |
| EPIC-PLU-03 | Pricing Dinâmico e Gestão de Ocupação | 📋 Planning | +R$15-20k/mês |
| EPIC-PLU-04 | CRM e Programa de Retenção | 📋 Planning | +R$10-15k/mês |
| EPIC-PLU-05 | Analytics e Dashboard de Receita | 📋 Planning | Indireto |

> Sequência recomendada em: `docs/stories/epics/EPIC-INDEX.md`

---

## KPIs e Métricas de Sucesso

| Métrica | Meta MVP | Meta Final |
|---------|----------|-----------|
| Receita bruta/mês | R$60.000 | R$100.000 |
| % reservas diretas | >50% | >70% |
| NPS hóspedes | >60 | >70 |
| Tempo resposta WhatsApp | <10s | <5s |
| Taxa conversão lead→reserva | >20% | >25% |
| Taxa ocupação anual | — | 75% |
| RevPAR | — | R$250+/noite |

---

## Próximos Passos (por prioridade)

1. **[Humano]** Deploy webhook Vercel + registrar URL na Meta
2. **[Humano]** Setup Meta Business Manager + migrar número
3. **[Humano]** Criar conta Make.com + configurar cenários com blueprints
4. **[Humano]** Criar base Airtable com schema documentado
5. **[@dev]** Implementar roteamento DeepSeek/Claude no Make.com (DT-05)
6. **[@dev]** Adicionar retry logic e rate limiting (DT-06, DT-07)
7. **[@devops]** Configurar monitoramento de uptime (DT-12)
8. **[@analyst]** Pesquisa competitiva para definir preços alta temporada (DT-09)
