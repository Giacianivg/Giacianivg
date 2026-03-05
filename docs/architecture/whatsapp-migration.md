# WhatsApp Business API — Configuração

**Pousada Luz da Lua | Socorro-SP**
**Número do Bot (Luna):** (19) 99862-5393 — registrar na Cloud API
**Número da Equipe (manual):** (19) 99840-0306 — permanece no WhatsApp Business App
**Criado:** 2026-02-22 | **Atualizado:** 2026-03-04 | **Story:** PLU-01.1

---

## Visão Geral

Este documento descreve o registro do número **(19) 99862-5393** (novo chip) na **WhatsApp Business API (Meta Cloud API)**, habilitando automação via Make.com + Claude (chatbot "Luna"). O número **(19) 99840-0306** permanece no WhatsApp Business App no celular da equipe para atendimento manual e notificações de escalação.

---

## Credenciais e IDs (sem tokens — ver .env)

| Variável | Descrição | Onde obter |
|----------|-----------|-----------|
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número de telefone na API | Meta Developers Portal → WhatsApp → Phone Numbers |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID da conta WhatsApp Business | Meta Developers Portal → WhatsApp → Getting Started |
| `WHATSAPP_ACCESS_TOKEN` | System User Token permanente | Meta Business Manager → System Users |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificação do webhook | Definido por nós (string aleatória) |
| `WEBHOOK_URL` | URL pública do webhook | Após deploy no Vercel |
| `MAKE_WEBHOOK_URL` | URL do webhook do Make.com | Make.com → Cenário → Webhook trigger |

> ⚠️ Os tokens reais estão no arquivo `.env` (nunca commitado no git).

---

## BSP Utilizado

**Meta Cloud API (direto)** — sem intermediário pago.

- Custo de BSP: **R$0/mês**
- Custo por conversa iniciada pelo usuário: gratuita (primeiras 1.000/mês), depois ~R$0,18/conversa
- Custo por conversa iniciada pelo negócio (templates): ~R$0,21/conversa

---

## URL do Webhook

```
https://webhook-six-topaz.vercel.app/webhook
```

> Deploy realizado em 2026-03-04. Registrar no Meta Developers Portal → WhatsApp → Configuration → Webhook.

---

## Arquitetura do Fluxo

```
Hóspede (WhatsApp)
  ↓ mensagem
Meta Cloud API
  ↓ POST /webhook (≤5s para 200 OK)
Vercel (este handler — handler.js)
  ↓ forward JSON payload
Make.com (orquestrador)
  ├─→ Airtable (busca histórico / registra conversa)
  ├─→ Anthropic API (Claude Sonnet 4.6 — chatbot "Luna")
  └─→ Meta Cloud API (envia resposta ao hóspede)
```

---

## Eventos Subscritos no Webhook

| Evento | Descrição |
|--------|-----------|
| `messages` | Mensagens recebidas dos hóspedes |
| `message_deliveries` | Confirmação de entrega |
| `message_reads` | Confirmação de leitura |

---

## Estrutura do Payload Encaminhado ao Make.com

```json
{
  "messageId": "wamid.xxx",
  "from": "5519999999999",
  "name": "João Silva",
  "timestamp": "1708000000",
  "type": "text",
  "text": "Olá, quero fazer uma reserva!",
  "phoneNumberId": "123456789",
  "businessAccountId": "987654321"
}
```

---

## Templates Criados

### Template 1: `boas_vindas`

```
Olá {{1}}! 🌙 Bem-vindo(a) à Pousada Luz da Lua em Socorro-SP!
Ficamos felizes em receber sua mensagem. Nossa equipe está analisando
sua solicitação e responderemos em breve.
```

**Status:** Aguardando aprovação Meta (prazo: até 24h após submissão)

### Template 2: `fora_de_atendimento`

```
Olá {{1}}! No momento estamos fora do horário de atendimento (seg-dom 8h-22h).
Sua mensagem foi recebida e responderemos assim que retornarmos. ☀️
```

**Status:** Aguardando aprovação Meta

---

## Procedimento de Migração

### Pré-requisitos
- [x] Meta Business Manager configurado com CNPJ da pousada ✅
- [ ] Verificação de negócio aprovada (pode levar 1-3 dias úteis)
- [x] Número do bot disponível: (19) 99862-5393 (novo chip) ✅
- [ ] Deploy do webhook em URL pública (Vercel)
- [ ] Equipe informada que (19) 99840-0306 permanece no app (sem downtime)

### Passos

1. **Meta Developers Portal** → Criar app → Adicionar produto "WhatsApp"
2. **Obter credenciais**: Phone Number ID, Business Account ID
3. **Gerar System User Token** permanente (não expira)
4. **Deploy do webhook** no Vercel: `vercel deploy` na pasta `src/webhook/`
5. **Registrar webhook URL** no Meta Developers Portal (campo "Webhook URL")
6. **Meta Developers Portal** → WhatsApp → Phone Numbers → **Add phone number** → inserir (19) 99862-5393
7. Verificar o novo número via SMS ou ligação (processo de ~5 minutos)
8. Verificar status "Connected" no Meta Developers Portal
9. Anotar o `Phone Number ID` do número (19) 99862-5393
10. Testar envio e recebimento com mensagem real de outro celular

### Horário de Downtime

| Campo | Valor |
|-------|-------|
| Início | _a preencher_ |
| Fim | _a preencher_ |
| Duração real | _a preencher_ |
| Meta: máx. | 4 horas |

---

## Procedimento de Rollback

Se necessário reverter para o WhatsApp Business App:

1. Meta Developers Portal → WhatsApp → Phone Numbers → **Deregister**
2. Aguardar confirmação (pode levar 1-6h)
3. Reinstalar WhatsApp Business App no aparelho
4. Registrar o número novamente via SMS/chamada
5. Informar equipe da reversão

> ⚠️ O rollback pode requerer nova verificação por SMS e pode demorar algumas horas.

---

## Arquitetura de Dois Números

| Número | Uso | Canal |
|--------|-----|-------|
| **(19) 99862-5393** | Bot "Luna" — atendimento automatizado 24/7 | WhatsApp Business API (Cloud API) |
| **(19) 99840-0306** | Equipe — atendimento manual e notificações de escalação | WhatsApp Business App (celular) |

Para atendimento manual:
- Hóspedes escalados pelo bot recebem mensagem e a equipe usa **(19) 99840-0306** para dar continuidade
- O número (19) 99840-0306 **permanece inalterado** no WhatsApp Business App

---

## Custos Estimados

| Item | Custo |
|------|-------|
| BSP (Meta Cloud API direto) | R$0/mês |
| Conversas inbound (até 1.000/mês) | R$0 |
| Conversas inbound (acima de 1.000) | ~R$0,18/conversa |
| Templates de negócio (outbound) | ~R$0,21/conversa |
| Estimativa MVP (1.000 conv/mês) | ~R$0-50/mês |
| Vercel Hobby (webhook hosting) | R$0/mês |

---

## Referências

- [Meta Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Webhook Setup Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks)
- [Phone Number Migration](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/migrate-existing-whatsapp-number-to-a-business-account)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)
