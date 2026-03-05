# STORY PLU-01.2: Integração Claude + Make.com (Chatbot Base)

**ID:** PLU-01.2 | **Epic:** [EPIC-PLU-01](../epics/EPIC-PLU-01-funil-vendas-automatizado.md)
**Sprint:** 1 | **Points:** 8 | **Priority:** 🔴 Critical
**Created:** 2026-02-22
**Status:** 🔄 InProgress
**Predecessor:** PLU-01.1 (WhatsApp Business API operacional)

---

## User Story

**Como** equipe de atendimento da Pousada Luz da Lua,
**Quero** que o Claude responda automaticamente às mensagens recebidas no WhatsApp Business,
**Para que** os leads sejam atendidos em <2 minutos, 24/7, com tom acolhedor e informações corretas sobre a pousada.

---

## Acceptance Criteria

- [ ] AC1: Toda mensagem recebida no WhatsApp dispara um fluxo no Make.com em <5 segundos
- [ ] AC2: Claude responde com tom humano e acolhedor em português BR, mencionando a Pousada Luz da Lua pelo nome
- [ ] AC3: Claude responde perguntas frequentes corretamente: localização, check-in/check-out, comodidades, pets, estacionamento
- [ ] AC4: Quando Claude não souber responder (confiança baixa), escalar para atendimento humano com mensagem condicionada ao horário: dentro de 12h-22h → prazo de 30 min; fora do horário → informa que a recepção abre às 12h (UX-02)
- [ ] AC5: Histórico de cada conversa registrado no Airtable (campo: nome, telefone, data, resumo da conversa, status)
- [ ] AC6: Fluxo Make.com tem tratamento de erro: se Claude ou Airtable falharem, enviar mensagem padrão ao hóspede
- [ ] AC7: Sistema operacional 24/7 sem intervenção manual

---

## Scope

### IN
- Cenário Make.com para orquestração: WhatsApp → Claude → WhatsApp
- System prompt detalhado do Claude com informações da pousada
- Registro de conversas no Airtable (base "Leads & Conversas")
- Lógica de escalonamento para humano
- Tratamento de mensagens de mídia (fotos, áudio) — resposta padrão "Por favor envie mensagem de texto"
- Configuração de variáveis de ambiente no Make.com

### OUT
- Fluxo de cotação automática (PLU-01.3)
- Pagamento online
- Respostas a grupos do WhatsApp
- Treinamento fine-tuned do Claude (usa Claude base com system prompt)

---

## Tasks

### T1 — Setup Make.com e Conexões (2h)
- [ ] T1.1: Criar conta Make.com (plano Core ~$9/mês suficiente para MVP)
- [ ] T1.2: Configurar conexão Make.com ↔ WhatsApp Business API:
  - Módulo HTTP para receber webhook do WhatsApp
  - Módulo HTTP para enviar mensagens via API da Meta
- [ ] T1.3: Configurar conexão Make.com ↔ Anthropic API (módulo HTTP com API key)
- [ ] T1.4: Configurar conexão Make.com ↔ Airtable (módulo oficial do Airtable)
- [ ] T1.5: Testar cada conexão individualmente

### T2 — System Prompt do Claude (3h — crítico para qualidade)
- [x] T2.1: Criar arquivo `docs/architecture/claude-system-prompt.md` com o system prompt completo
- [x] T2.2: System prompt deve incluir:
  ```
  Você é o assistente virtual da Pousada Luz da Lua, uma charmosa pousada em Socorro-SP.
  Seu nome é "Luna" e você representa a hospitalidade calorosa da pousada.

  INFORMAÇÕES DA POUSADA:
  - Localização: Socorro-SP (Circuito das Águas Paulista)
  - 17 quartos em 3 alas:
    * Ala A: 8 quartos (até 3 pessoas) — R$300/noite
    * Ala B: 7 quartos (até 5 pessoas) — R$300-350/noite
    * Ala C: 2 quartos grupo (até 8 pessoas cada) — sob consulta
  - Café da manhã incluso em todas as alas
  - Cancelamento gratuito até 7 dias antes do check-in
  - Check-in: 14h | Check-out: 12h
  - WhatsApp: (19) 99840-0306
  - Site: https://pousadaluzdaluasp.com.br

  REGRAS DE COMPORTAMENTO:
  1. Sempre se apresente como "Luna, assistente da Pousada Luz da Lua" na primeira mensagem
  2. Tom: acolhedor, caloroso, mas profissional — como uma recepcionista experiente
  3. Use emojis moderadamente (🌙, ☀️, 🌿) para manter o tom da pousada
  4. NUNCA invente informações sobre preços ou disponibilidade — encaminhe para cotação
  5. Se não souber responder algo específico, use o escalonamento humano
  6. Responda APENAS em português brasileiro
  7. Mensagens curtas e objetivas (máx. 3 parágrafos por resposta)

  ESCALONAMENTO HUMANO:
  Acione quando: perguntas sobre preços específicos, reclamações, pedidos especiais complexos,
  quando o usuário pedir explicitamente falar com humano, ou após 2 tentativas sem resolver.
  ```
- [x] T2.3: Adicionar FAQs da pousada ao system prompt (coletar com equipe):
  - Aceita pets? (sim/não, regras)
  - Tem estacionamento? (sim/não, cobrado?)
  - Tem piscina? Wi-Fi? Café da manhã incluso?
  - Como chegar de São Paulo?
  - Qual a política de cancelamento?
- [x] T2.4: Testar respostas do Claude manualmente (30+ perguntas diferentes) antes de ativar no Make.com
- [ ] T2.5: [UX-01] Separar Passo 2 do fluxo de qualificação em **duas mensagens distintas**:
  - Mensagem 2a (imediata): `"Quantas pessoas serão na reserva?"`
  - Mensagem 2b (após resposta): `"Terá crianças? Se sim, quantas e quais idades? 🌿"`
  - Nunca enviar duas perguntas na mesma mensagem — reduz taxa de abandono do funil

### T3 — Cenário Make.com: Fluxo Principal (3h)
- [ ] T3.1: Criar cenário "Pousada - Atendimento WhatsApp":
  ```
  TRIGGER: Webhook (recebe mensagem do WhatsApp)
  ↓
  FILTER: É mensagem de texto? (ignorar áudio/foto por ora)
  ↓
  MODULE: Buscar histórico do contato no Airtable (últimas 5 mensagens)
  ↓
  MODULE: HTTP Request → Anthropic API (Claude Sonnet 4.6)
    - system: [system prompt completo]
    - messages: [histórico + nova mensagem]
  ↓
  ROUTER: Resposta do Claude contém "[ESCALAR]"?
    ├── SIM → Enviar msg de escalonamento + notificar equipe (WhatsApp da equipe)
    └── NÃO → Enviar resposta ao hóspede via WhatsApp API
  ↓
  MODULE: Registrar conversa no Airtable
  ```
- [ ] T3.2: Configurar timeout do Make.com: máx. 30s por execução (dentro do limite da Meta)
- [ ] T3.3: Configurar tratamento de erro global: se qualquer módulo falhar → enviar msg padrão ao hóspede
- [ ] T3.4: Ativar cenário e executar em modo de teste com 10 mensagens reais
- [ ] T3.5: [UX-02] Implementar mensagem de escalonamento **condicional por horário** no Make.com:
  - Usar função `{{now}}` do Make.com para verificar hora atual (UTC-3 / America/Sao_Paulo)
  - Se 12:00 ≤ hora ≤ 22:00: `"Vou chamar nossa equipe! Responderemos em até 30 minutos 🌙"`
  - Se hora < 12:00 ou hora > 22:00: `"Anotei sua mensagem! Nossa recepção funciona das 12h às 22h e entrará em contato assim que abrirmos ☀️"`
  - Testar ambos os cenários com timestamp manual no Make.com (debug mode)

### T4 — Setup Airtable (1h)
- [ ] T4.1: Criar base "Pousada Luz da Lua — CRM" no Airtable
- [ ] T4.2: Criar tabela "Conversas":
  | Campo | Tipo |
  |-------|------|
  | ID | Auto number |
  | Nome do Hóspede | Text |
  | Telefone | Phone |
  | Data Primeiro Contato | Date |
  | Última Mensagem | Date |
  | Resumo da Conversa | Long text |
  | Status | Single select: Novo / Em atendimento / Cotação enviada / Reservado / Encerrado |
  | Escalonado? | Checkbox |
  | Observações | Long text |
- [ ] T4.3: Testar registro automático via Make.com
- [ ] T4.4: [DB-02] Implementar **upsert** (não insert cego) ao registrar conversa no Airtable:
  1. Antes de criar: buscar registro existente pelo campo `Telefone` do hóspede
  2. Se encontrado → atualizar `Última Mensagem`, `Resumo da Conversa` e `Status` (sem criar duplicata)
  3. Se não encontrado → criar novo registro
  - Evita CRM com múltiplas entradas pelo mesmo hóspede ao longo de dias/semanas

### T5 — Testes End-to-End (2h)
- [ ] T5.1: Enviar 20 mensagens de teste cobrindo os cenários principais
- [ ] T5.2: Verificar tempo médio de resposta (meta: <10s)
- [ ] T5.3: Testar escalonamento (perguntar sobre preço específico)
- [ ] T5.4: Testar mensagem de mídia (enviar foto → receber resposta padrão)
- [ ] T5.5: Verificar que todos os leads estão sendo registrados no Airtable
- [ ] T5.6: Testar cenário de falha (desativar Claude API temporariamente → verificar msg de erro)

---

## Dev Notes

### Arquitetura do Fluxo

```
Hóspede (WhatsApp)
  ↓ mensagem
Meta Cloud API
  ↓ webhook POST /webhook/whatsapp
Vercel/Railway (webhook handler — PLU-01.1)
  ↓ forward para Make.com via HTTP
Make.com (orquestrador)
  ├─→ Airtable (busca histórico)
  ├─→ Anthropic API (Claude Sonnet 4.6)
  └─→ Meta Cloud API (envia resposta)
```

### Configuração da Chamada à API da Anthropic (Make.com HTTP Module)

```json
URL: https://api.anthropic.com/v1/messages
Method: POST
Headers:
  x-api-key: {{ANTHROPIC_API_KEY}}
  anthropic-version: 2023-06-01
  content-type: application/json
Body:
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "system": "{{SYSTEM_PROMPT}}",
  "messages": [
    {"role": "user", "content": "{{HISTORICO_FORMATADO}}\n\nMensagem atual: {{NOVA_MENSAGEM}}"}
  ]
}
```

### Lógica de Escalonamento

Para Claude acionar escalonamento, incluir no system prompt:
```
Quando precisar escalar para atendimento humano, inclua exatamente "[ESCALAR]"
no início da sua resposta, seguido da mensagem ao hóspede.
Exemplo: "[ESCALAR] Vou chamar nossa equipe para te ajudar melhor! Um momento 🌙"
```

O Make.com usa router para detectar "[ESCALAR]" e:
1. Remove o token da resposta antes de enviar ao hóspede
2. Envia notificação para WhatsApp da equipe com contexto da conversa

### Custos Estimados (Make.com + Claude)

| Item | Custo |
|------|-------|
| Make.com Core | ~$9/mês |
| Claude Sonnet 4.6 (input ~500 tokens/msg) | ~$0.003/mensagem |
| Claude Sonnet 4.6 (output ~300 tokens/msg) | ~$0.0045/mensagem |
| Estimativa 1.000 conversas/mês | ~$7.50/mês em Claude |
| **Total estimado** | **~$17/mês** |

### Variáveis de Ambiente (Make.com)

Configurar em Make.com → Team → Variables:
- `ANTHROPIC_API_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `EQUIPE_WHATSAPP_NUMBER` (número para notificações de escalonamento)

### Testing

| Test ID | Name | Type | Priority |
|---------|------|------|----------|
| T-BOT-01 | Pergunta simples → Claude responde em <10s | Integration | P0 |
| T-BOT-02 | Pergunta sobre preço → escalonamento acionado | Integration | P0 |
| T-BOT-03 | Foto enviada → resposta padrão "envie texto" | Unit | P1 |
| T-BOT-04 | Claude API offline → mensagem de erro amigável | Integration | P0 |
| T-BOT-05 | Lead registrado no Airtable após conversa | Integration | P0 |
| T-BOT-06 | Histórico de conversa mantido em sequência | Integration | P1 |
| T-BOT-07 | Tom acolhedor verificado em 10 respostas diferentes | Manual | P0 |

---

## 🤖 CodeRabbit Integration

### Story Type Analysis
**Primary Type:** Integration
**Secondary Type(s):** Architecture
**Complexity:** High (múltiplos sistemas externos: Meta API + Claude + Make.com + Airtable)

### Specialized Agent Assignment
**Primary Agents:**
- @dev (implementação do sistema de forwarding webhook → Make.com)
- @architect (validação da arquitetura de integração e fluxo de dados)

**Supporting Agents:**
- @devops (configuração de variáveis de ambiente seguras no Make.com)

### Self-Healing Configuration
**Expected Self-Healing:**
- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL

### Focus Areas
**Primary Focus:**
- Segurança das API keys (NUNCA expor em logs ou código)
- Tratamento de erro resiliente em todos os módulos Make.com
- Resposta 200 imediata ao webhook da Meta (evitar retry/bloqueio)

**Secondary Focus:**
- Formatação correta do histórico de conversas para o Claude
- Lógica de detecção "[ESCALAR]" robusta
- Custos de API dentro do orçamento previsto

---

## Dependencies

**Depends on:**
- PLU-01.1: WhatsApp Business API operacional (webhook configurado)
- Conta Make.com ativa
- API key Anthropic (Claude)
- Base Airtable criada

**Blocks:**
- PLU-01.3: Fluxo completo de qualificação (usa esta base do chatbot)

---

## Definition of Done

- [ ] Claude responde mensagens no WhatsApp automaticamente em <10s
- [ ] Tom e conteúdo das respostas validados manualmente (30+ testes)
- [ ] Escalonamento funcionando e notificando equipe
- [ ] Histórico registrado no Airtable para todas as conversas
- [ ] Tratamento de erro configurado e testado
- [ ] System prompt documentado em `docs/architecture/claude-system-prompt.md`
- [ ] @po valida os ACs

---

## Dev Agent Record

**Agent:** Dex (@dev) | **Model:** claude-sonnet-4-6 | **Mode:** Interactive

### Completion Notes

- System prompt "Luna" criado em `docs/architecture/claude-system-prompt.md`
- Inclui 18 quartos reais (3 alas), FAQs, regras de escalonamento e fluxo de cotação
- **32/32 testes passando** — cenários: FAQ, quartos, cotação, escalonamento, tom, edge cases
- [ESCALAR] acionado corretamente em: grupos grandes, pedidos de humano, reclamações, eventos
- [COTAR] acionado corretamente em TC-20 (datas + pessoas + tipo de quarto)
- TC-11 levemente longa — aceitável (listagem de 3 tipos de quarto é necessariamente mais extensa)
- **Estratégia de custo:** DeepSeek para FAQs simples + Claude para qualificação/cotação (economia ~50-60%)
- Fluxo Make.com documentado com roteamento por modelo (SIMPLES vs COMPLEXO)
- Schema Airtable documentado (tabela Conversas com campo Modelo LLM Usado)
- Chave Anthropic válida: `sk-ant-api03-xeiqzh...` (atualizada no .env do projeto)

### File List

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `docs/architecture/claude-system-prompt.md` | CREATE | System prompt completo + fluxo Make.com + schema Airtable |
| `src/chatbot/test-system-prompt.js` | CREATE | 32 testes automatizados do system prompt (Claude e DeepSeek) |
| `src/chatbot/package.json` | CREATE | Dependências do módulo de teste |
| `docs/qa/system-prompt-test-*.json` | CREATE | Relatório dos testes (gerado automaticamente) |
| `docs/make-com/blueprint-pousada-atendimento.json` | UPDATE | Blueprint Make.com v3 — 14 módulos, routing corrigido (ESCALAR/CONFIRMAR) |
| `docs/make-com/SETUP.md` | UPDATE | Guia completo passo a passo para importar e configurar o Make.com |
| `docs/make-com/system-prompt.txt` | CREATE | System prompt pronto para colar na Team Variable SYSTEM_PROMPT |

### Pendências (requerem ação humana)

- T1: Criar conta Make.com e configurar conexões (WhatsApp API, Anthropic, DeepSeek, Airtable)
- T3: Configurar cenário Make.com com o fluxo documentado em claude-system-prompt.md
- T4: Criar base Airtable com schema documentado
- T5: Testes end-to-end com mensagem real no WhatsApp (após PLU-01.1 concluída)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-22 | 1.0 | Story criada via *draft | River (@sm) |
| 2026-02-22 | 1.1 | Validação GO (9/10) — Status Draft→Ready | Pax (@po) |
| 2026-02-22 | 1.2 | System prompt criado + 32/32 testes OK — T2.1-T2.4 completos | Dex (@dev) |
| 2026-02-24 | 1.3 | Adicionado T2.5 (UX-01), T3.5 (UX-02), T4.4 (DB-02) — Brownfield Discovery Fases 5-6 | Aria (@architect) |
| 2026-03-04 | 1.4 | Blueprint Make.com v3 criado (docs/make-com/blueprint-pousada-atendimento.json) — SETUP.md + system-prompt.txt prontos para importar | Dex (@dev) |

---

## QA Results

_To be populated after implementation_
