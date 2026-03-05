# STORY PLU-01.1: Migração WhatsApp Business App → Business API

**ID:** PLU-01.1 | **Epic:** [EPIC-PLU-01](../epics/EPIC-PLU-01-funil-vendas-automatizado.md)
**Sprint:** 1 | **Points:** 5 | **Priority:** 🔴 Critical
**Created:** 2026-02-22
**Status:** 🔄 InProgress

---

## User Story

**Como** gestor da Pousada Luz da Lua,
**Quero** migrar o número (19) 99840-0306 do WhatsApp Business App para a WhatsApp Business API (Meta),
**Para que** seja possível automatizar o atendimento via Claude e Make.com, mantendo o histórico de contatos e sem perder leads durante a transição.

---

## Acceptance Criteria

- [ ] AC1: O número (19) 99840-0306 está operando via WhatsApp Business API com status "Connected" no Meta Business Manager
- [ ] AC2: Mensagens enviadas ao número são recebidas via webhook HTTPS configurado (endpoint respondendo 200 OK)
- [ ] AC3: A equipe consegue enviar mensagens manuais pelo mesmo número via interface de gerenciamento (Meta Business Suite ou parceiro BSP)
- [ ] AC4: Templates de boas-vindas aprovados pela Meta (mínimo 2 templates: boas-vindas + horário de atendimento)
- [ ] AC5: Downtime de atendimento durante migração inferior a 4 horas (executar fora do horário de pico)
- [ ] AC6: Número de telefone não é banido/suspenso pela Meta durante o processo
- [ ] AC7: Documentação do processo de migração registrada em `docs/architecture/whatsapp-migration.md`

---

## Scope

### IN
- Criação/verificação de Meta Business Account com CNPJ da pousada
- Registro do número (19) 99840-0306 na WhatsApp Business API
- Escolha e configuração de BSP (Business Solution Provider) — recomendado: Meta direto via Developers Portal ou Twilio/360dialog como alternativas
- Configuração de webhook HTTPS para recebimento de mensagens
- Criação e submissão de 2 templates de mensagem para aprovação Meta
- Documentação do processo

### OUT
- Automação do chatbot (PLU-01.2)
- Migração de histórico de conversas antigas (não suportado pela Meta)
- Configuração de múltiplos números
- WhatsApp Web integrado para equipe (manter app separado no aparelho da equipe)

---

## Tasks

### T1 — Verificação e Setup Meta Business (1h)
- [x] T1.1: Confirmar se já existe Meta Business Manager configurado para a pousada
- [x] T1.2: Verificar CNPJ da pousada e documentação necessária para verificação de negócio
- [x] T1.3: Criar ou acessar Meta Business Manager em business.facebook.com
- [ ] T1.4: Completar verificação de negócio (pode levar 1-3 dias úteis) ← **aguardando aprovação Meta**

### T2 — Escolha de BSP e Conta WhatsApp Cloud API (1h)
- [ ] T2.1: Avaliar opções de BSP: Meta Cloud API (gratuito, auto-gerenciado) vs. 360dialog (pago, mais fácil) vs. Twilio
- [ ] T2.2: **Recomendação**: usar Meta Cloud API diretamente (custo zero de BSP, apenas custo por conversa)
- [ ] T2.3: Criar app no Meta Developers Portal (developers.facebook.com)
- [ ] T2.4: Adicionar produto "WhatsApp" ao app criado
- [ ] T2.5: Obter `Phone Number ID` e `WhatsApp Business Account ID`
- [ ] T2.6: Gerar token de acesso permanente (System User Token)

### T3 — Registro de Número Novo para o Bot (1h) ✅ Decisão: Número novo
> **Decisão arquitetural (2026-02-24):** Usar número dedicado para o bot (Luna). O número `(19) 99840-0306` **permanece no WhatsApp Business App** no celular da equipe, sem migração e sem downtime.

- [ ] T3.1: Adquirir um chip/SIM novo (qualquer operadora, pré-pago serve) — só precisa receber 1 SMS ou ligação para verificação
- [ ] T3.2: No Meta Developers Portal → App → WhatsApp → Phone Numbers → **Add phone number**
- [ ] T3.3: Verificar o novo número via SMS ou ligação (processo de ~5 minutos)
- [ ] T3.4: Confirmar que o novo número aparece com status **"Connected"** na API
- [ ] T3.5: Anotar o `Phone Number ID` do novo número (necessário para enviar mensagens via API)

### T4 — Configuração do Webhook (1h)
- [x] T4.1: Criar endpoint HTTPS de webhook (URL pública — usar Vercel ou Railway para deploy rápido)
- [x] T4.2: Implementar handler básico do webhook que responde 200 OK ao challenge de verificação da Meta
- [x] T4.1b: Deploy realizado → https://webhook-six-topaz.vercel.app
- [x] T4.3: Registrar URL do webhook no Meta Developers Portal com Verify Token configurado
- [x] T4.4: Subscrever ao evento `messages` ✅
- [x] T4.5: Testar recebimento de mensagem real ao número ✅ — mensagem chegou

### T5 — Templates de Mensagem (2h)
- [ ] T5.1: Criar template "boas_vindas" no Meta Business Manager:
  ```
  Olá {{1}}! 🌙 Bem-vindo(a) à Pousada Luz da Lua em Socorro-SP!
  Ficamos felizes em receber sua mensagem. Nossa equipe está analisando sua solicitação e responderemos em breve.
  ```
- [ ] T5.2: Criar template "fora_de_atendimento":
  ```
  Olá {{1}}! No momento estamos fora do horário de atendimento (seg-dom 8h-22h).
  Sua mensagem foi recebida e responderemos assim que retornarmos. ☀️
  ```
- [ ] T5.3: Submeter templates para aprovação da Meta (prazo: até 24h)
- [ ] T5.4: Aguardar aprovação antes de ativar automação

### T6 — Documentação e Validação (1h)
- [x] T6.1: Criar `docs/architecture/whatsapp-migration.md` com:
  - Phone Number ID e Business Account ID (sem tokens — usar referência ao .env)
  - URL do webhook configurada
  - BSP utilizado e configurações
  - Procedimento de rollback se necessário
- [ ] T6.2: Testar envio e recebimento de mensagem via API usando curl/Postman
- [ ] T6.3: Validar todos os ACs
- [ ] T6.4: Informar equipe que o número está operando via API

### T7 — Verificação de Segurança do Webhook (1h) [QA-01]

> ⚠️ **Crítico antes de tráfego real.** A Meta reenvia webhooks não confirmados — sem validação de assinatura, qualquer agente externo pode injetar mensagens falsas no sistema.

- [ ] T7.1: Inspecionar `src/webhook/handler.js` — verificar se o header `X-Hub-Signature-256` é validado em cada POST recebido
- [ ] T7.2: Se **não** implementado, adicionar validação HMAC-SHA256 antes de processar qualquer mensagem:
  ```javascript
  const crypto = require('crypto');

  // Middleware de verificação — registrar ANTES das rotas POST
  app.use(express.json({
    verify: (req, res, buf) => {
      const signature = req.headers['x-hub-signature-256'];
      if (!signature) throw Object.assign(new Error('Assinatura ausente'), { status: 401 });
      const expected = 'sha256=' + crypto
        .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
        .update(buf)
        .digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
        throw Object.assign(new Error('Assinatura inválida'), { status: 401 });
    }
  }));
  ```
- [ ] T7.3: Adicionar `WHATSAPP_APP_SECRET` ao `.env.example` (obtido no Meta Developers Portal → App → Settings → Basic → App Secret)
- [ ] T7.4: Testar 3 cenários em `handler.test.js`:
  - Request sem header `x-hub-signature-256` → resposta 401
  - Request com assinatura inválida → resposta 401
  - Request com assinatura HMAC-SHA256 correta → processado normalmente
- [ ] T7.5: Se QA-01 já estava implementado (T7.1 confirmado), registrar no Change Log e encerrar esta task

---

## Dev Notes

### Informações Técnicas Essenciais

**Número existente (mantido no app):** (19) 99840-0306 — continua no WhatsApp Business App no celular
**Número do bot (Luna / novo chip):** (19) 99862-5393 — registrar na Cloud API

**Meta Cloud API — Credenciais necessárias (guardar no .env):**
```
WHATSAPP_PHONE_NUMBER_ID=<obtido no Meta Developers Portal>
WHATSAPP_BUSINESS_ACCOUNT_ID=<obtido no Meta Developers Portal>
WHATSAPP_ACCESS_TOKEN=<System User Token permanente>
WHATSAPP_VERIFY_TOKEN=<string aleatória para verificar webhook>
WHATSAPP_APP_SECRET=<App Secret — Meta Developers Portal → App → Settings → Basic>
WEBHOOK_URL=https://<domínio>/webhook/whatsapp
```

**Estrutura básica do webhook handler (Node.js):**
```javascript
// GET /webhook — Verificação inicial da Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// POST /webhook — Recebimento de mensagens
app.post('/webhook', (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    // Processar mensagem
    console.log('Mensagem recebida:', JSON.stringify(body, null, 2));
    res.sendStatus(200); // SEMPRE responder 200 rapidamente
  }
});
```

**Custo estimado da WhatsApp Business API (Meta, 2026):**
- Conversas iniciadas pelo usuário: gratuitas (primeiras 1.000/mês) → ~R$0.18/conversa depois
- Conversas iniciadas pelo negócio (templates): ~R$0.21/conversa
- Estimativa para MVP: ~R$200-400/mês para 1.000-2.000 conversas

**Fluxo de atendimento com dois números:**
- Hóspede quer cotar → manda mensagem para o **número do bot** → Luna atende automaticamente
- Hóspede liga ou manda para o número conhecido → equipe atende normalmente pelo **app no celular**
- Escalonamentos do bot → equipe recebe notificação no número `(19) 99840-0306` (via WhatsApp normal)

### Testing

| Test ID | Name | Type | Priority |
|---------|------|------|----------|
| T-WAP-01 | Webhook responde 200 ao challenge de verificação da Meta | Integration | P0 |
| T-WAP-02 | Mensagem enviada ao número é recebida no webhook | Integration | P0 |
| T-WAP-03 | Token de acesso permanente válido (não expira) | Smoke | P0 |
| T-WAP-04 | Template "boas_vindas" aprovado pela Meta | Manual | P0 |
| T-WAP-05 | Equipe consegue enviar mensagem manual pelo número via BSP | Smoke | P1 |

---

## 🤖 CodeRabbit Integration

### Story Type Analysis
**Primary Type:** Deployment/Infrastructure
**Secondary Type(s):** Integration
**Complexity:** Medium (envolve serviços externos da Meta + deploy de webhook)

### Specialized Agent Assignment
**Primary Agents:**
- @devops (configuração de infraestrutura e deploy do webhook)
- @dev (implementação do handler de webhook)

**Supporting Agents:**
- @architect (validação do padrão de webhook e segurança do token)

### Self-Healing Configuration
**Expected Self-Healing:**
- Primary Agent: @devops (check mode)
- Max Iterations: 0
- Timeout: N/A
- Severity Filter: report_only

### Focus Areas
**Primary Focus:**
- Segurança do WHATSAPP_VERIFY_TOKEN (não exposto em código)
- Variáveis de ambiente: todas as credenciais em .env, nunca hardcoded
- Webhook responde 200 imediatamente antes de processar (evitar timeout da Meta)

**Secondary Focus:**
- Documentação das credenciais (IDs, não tokens) em docs/architecture/
- Rollback documentado e testado

---

## Dependencies

**Depends on:**
- CNPJ da pousada disponível para verificação Meta Business
- Acesso ao aparelho com o número (19) 99840-0306

**Blocks:**
- PLU-01.2: Integração Claude + Make.com (precisa do webhook operacional)
- PLU-01.3: Fluxo completo (precisa da API ativa)

---

## Definition of Done

- [ ] Número (19) 99840-0306 conectado à WhatsApp Business API (status "Connected")
- [ ] Webhook HTTPS recebendo mensagens (testado com mensagem real)
- [ ] Mínimo 2 templates aprovados pela Meta
- [ ] Credenciais salvas em .env (não em código)
- [ ] Webhook valida X-Hub-Signature-256 em todos os POSTs (QA-01 verificado/implementado)
- [ ] Documentação criada em docs/architecture/whatsapp-migration.md
- [ ] Equipe informada e treinada no novo fluxo de atendimento manual
- [ ] @po valida os ACs

---

## Dev Agent Record

**Agent:** Dex (@dev) | **Model:** claude-sonnet-4-6 | **Mode:** Interactive

### Completion Notes

- Webhook handler criado em `src/webhook/handler.js` com Express
- Responde 200 IMEDIATAMENTE à Meta antes de processar (requisito crítico anti-timeout)
- Forward assíncrono para Make.com com tratamento de erro robusto
- 7/7 testes unitários passando (T-WAP-01 completo)
- Configuração Vercel pronta para deploy (`vercel.json`)
- Documentação de migração completa em `docs/architecture/whatsapp-migration.md`
- **Estratégia de API por custo:** DeepSeek para respostas simples (PLU-01.2), Claude apenas para qualificação/cotação complexa — economia estimada de 60-70% nos custos LLM

### File List

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/webhook/handler.js` | CREATE | Webhook handler principal (GET+POST /webhook, GET /health) |
| `src/webhook/package.json` | CREATE | Dependências Node.js (express, dotenv) |
| `src/webhook/vercel.json` | CREATE | Configuração de deploy no Vercel |
| `src/webhook/.env.example` | CREATE | Template de variáveis de ambiente |
| `src/webhook/tests/handler.test.js` | CREATE | 7 testes unitários (node:test nativo) |
| `docs/architecture/whatsapp-migration.md` | CREATE | Documentação de migração (AC7) |

### Pendências (requerem ação humana)

- T1-T3: Setup Meta Business Manager + registro do número (19) 99862-5393 na Cloud API
- T4.3-T4.5: Registrar URL do webhook no Meta Developers Portal após deploy Vercel
- T5: Criar e submeter templates de mensagem para aprovação Meta
- T6.2-T6.4: Testes com mensagem real + validação dos ACs

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-22 | 1.0 | Story criada via *draft | River (@sm) |
| 2026-02-22 | 1.1 | Validação GO (8/10) — Status Draft→Ready | Pax (@po) |
| 2026-02-22 | 1.2 | Webhook handler implementado (T4.1, T4.2, T6.1) — 7/7 testes OK | Dex (@dev) |
| 2026-02-24 | 1.3 | Adicionado T7 (QA-01 — X-Hub-Signature-256) — Brownfield Discovery Fase 7 | Aria (@architect) |
| 2026-02-24 | 1.4 | Gestão concluiu: Meta BM criado, página Facebook criada, número WA adicionado ao Meta BM, Airtable criado | Gestão |
| 2026-02-24 | 1.5 | Decisão: usar número novo dedicado para o bot — número (19) 99840-0306 permanece no WhatsApp Business App | Gestão |
| 2026-03-04 | 1.6 | Número do bot confirmado: (19) 99862-5393 (novo chip adquirido) — pronto para registrar na Cloud API | Gestão |
| 2026-03-04 | 1.7 | T4 concluído: deploy Vercel (https://webhook-six-topaz.vercel.app) + webhook Meta verificado + mensagem real recebida ✅ | Gestão |

---

## QA Results

_To be populated after implementation_
