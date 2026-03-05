# Make.com — Guia de Configuração Completo
## Pousada Luz da Lua — Atendimento WhatsApp (Luna)

**Blueprint:** v3 | **Atualizado:** 2026-03-04 | **Story:** PLU-01.2

---

## Visão Geral do Fluxo

```
Hóspede (WhatsApp)
  ↓ mensagem
Meta Cloud API — número (19) 99862-5393 (bot Luna)
  ↓ POST /webhook
Vercel (https://webhook-six-topaz.vercel.app/webhook)
  ↓ forward JSON
Make.com (este cenário)
  ├─ Módulo 3: Airtable — busca histórico do hóspede
  ├─ Módulo 4: Claude Sonnet 4.6 — gera resposta da Luna
  └─ Módulo 5: Router de ação (detecta token na resposta):
      ├─ [ESCALAR...]  → msg ao hóspede + notifica equipe (19) 99840-0306
      ├─ [COTAR: ...]  → /quote Vercel → envia cotação formatada
      ├─ [CONFIRMAR:]  → msg confirmação ao hóspede + notifica equipe
      └─ (sem token)   → envia resposta diretamente
  ↓
Módulo 13: Airtable — salva/atualiza conversa
```

---

## PRÉ-REQUISITOS

Antes de começar, confirme:

- [ ] Conta Make.com criada (make.com)
- [ ] Webhook Vercel funcionando: `https://webhook-six-topaz.vercel.app`
- [ ] Credenciais Meta Cloud API (Phone Number ID + Access Token)
- [ ] Chave Anthropic API (`sk-ant-api03-...`)
- [ ] Conta Airtable criada (airtable.com)

---

## PASSO 1 — Criar Webhook no Make.com

> O webhook é a "porta de entrada" — o Vercel enviará as mensagens para esta URL.

1. Acesse **make.com** → faça login
2. Menu lateral: **Webhooks** → **Create a webhook**
3. Nome: `pousada-whatsapp`
4. **Save**
5. **Copie a URL gerada** (formato: `https://hook.us2.make.com/xxxxx...`)
6. Guarde essa URL — usada no Passo 6

---

## PASSO 2 — Importar o Blueprint

1. Make.com → **Scenarios** → **Create a new scenario**
2. No cenário vazio, clique nos **três pontos (...)** → **Import Blueprint**
3. Selecione: `C:\projetos\pousada\meu-projeto\docs\make-com\blueprint-pousada-atendimento.json`
4. **Save**
5. O cenário "Pousada — Atendimento WhatsApp v3" será criado com 14 módulos

---

## PASSO 3 — Conectar o Webhook ao Cenário

Após importar, o módulo 1 ficará com erro (não conectado ao webhook).

1. Clique no **módulo 1** (ícone laranja de webhook)
2. No campo **Webhook**, selecione: `pousada-whatsapp`
3. **OK**

---

## PASSO 4 — Criar Team Variables

**Make.com → Team → Variables → Add variable**

Crie cada variável abaixo:

| Variável | Valor | Onde obter |
|----------|-------|-----------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Arquivo `.env` do projeto |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente Meta | Meta BM → System Users |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número (19) 99862-5393 | Meta Developers Portal |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | ID da conta WhatsApp Business | Meta Developers Portal |
| `AIRTABLE_API_KEY` | `pat...` | Configurar no Passo 5 |
| `AIRTABLE_BASE_ID` | `app...` | Configurar no Passo 5 |
| `EQUIPE_WHATSAPP_NUMBER` | `5519998400306` | Número fixo (sem + ou espaços) |
| `SYSTEM_PROMPT` | (conteúdo completo do arquivo abaixo) | Ver instrução abaixo |

### Como adicionar o SYSTEM_PROMPT

1. Abra: `C:\projetos\pousada\meu-projeto\docs\make-com\system-prompt.txt`
2. Selecione **todo o conteúdo** (Ctrl+A) → copie (Ctrl+C)
3. No Make.com Team Variables → crie `SYSTEM_PROMPT`
4. Cole o conteúdo no campo Value
5. **Save**

> O system prompt tem ~300 linhas. Isso é normal e esperado.

---

## PASSO 5 — Configurar Airtable

### 5.1 — Criar a base

1. **airtable.com** → **Create a base**
2. Nome: `Pousada Luz da Lua — CRM`
3. Delete a tabela padrão se necessário

### 5.2 — Criar tabela "Conversas"

Crie uma tabela chamada exatamente **Conversas** com os campos:

| Campo | Tipo Airtable | Notas |
|-------|--------------|-------|
| `Nome do Hospede` | Single line text | |
| `Telefone` | Phone number | Formato E.164: 5519999999999 |
| `Ultima Mensagem` | Date (com hora) | |
| `Ultima Msg Texto` | Long text | Texto da última mensagem recebida |
| `Status` | Single select | Ver valores abaixo |
| `Modelo LLM` | Single select | Ver valores abaixo |
| `Escalonado?` | Checkbox | |
| `Observacoes` | Long text | Notas manuais da equipe |

**Valores do Status:**
`Novo` | `Em atendimento` | `Cotação enviada` | `Reserva solicitada` | `Reservado` | `Encerrado`

**Valores do Modelo LLM:**
`Claude Sonnet 4.6` | `DeepSeek` | `Misto`

### 5.3 — Obter credenciais do Airtable

**AIRTABLE_API_KEY (Personal Access Token):**
1. Airtable → clique no avatar (canto superior direito)
2. **Developer hub** → **Personal access tokens** → **Create new token**
3. Nome: `make-pousada`
4. Scopes: marque `data.records:read` e `data.records:write`
5. Acesso: selecione a base "Pousada Luz da Lua — CRM"
6. **Create token** → copie o token gerado (começa com `pat...`)

**AIRTABLE_BASE_ID:**
1. Abra a base → veja a URL: `https://airtable.com/appXXXXXXXXXX/...`
2. Copie o `appXXXXXXXXXX` — esse é o Base ID

---

## PASSO 6 — Conectar Webhook ao Vercel

O Vercel precisa saber para onde encaminhar as mensagens do WhatsApp.

1. **vercel.com** → projeto `webhook-six-topaz` → **Settings** → **Environment Variables**
2. Adicione:
   - **Key:** `MAKE_WEBHOOK_URL`
   - **Value:** URL copiada no Passo 1 (`https://hook.us2.make.com/xxxxx...`)
3. **Save**
4. **Deployments** → último deploy → três pontos → **Redeploy**
5. Aguarde o redeploy

---

## PASSO 7 — Ativar o Cenário

1. Make.com → cenário "Pousada — Atendimento WhatsApp v3"
2. Toggle inferior esquerdo: **OFF → ON**
3. Cenário ativo e aguardando webhooks

---

## PASSO 8 — Testar o Fluxo Completo

### Teste 1 — FAQ simples
Mande do seu celular para **(19) 99862-5393**:
```
Oi, tem piscina?
```
Esperado: Luna responde em ~3-5s com info sobre a piscina

### Teste 2 — Fluxo de cotação
```
Quero reservar para 2 pessoas de 20/03 a 22/03, quarto casal
```
Esperado: Luna pergunta mais detalhes e gera cotação formatada

### Teste 3 — Escalonamento
```
Quero falar com uma pessoa
```
Esperado:
- Luna responde que vai chamar a equipe
- **(19) 99840-0306** recebe notificação com dados do hóspede

### Onde ver os logs:
Make.com → Scenarios → ícone de relógio → histórico de execuções
Módulos com erro ficam em vermelho — clique para ver detalhes

---

## PASSO 9 — Verificar Airtable

Após os testes:
- Tabela **Conversas** → deve ter 1 registro por conversa de teste
- Campos: Nome (se informado), Telefone, Ultima Mensagem, Ultima Msg Texto, Status

---

## LÓGICA DE ROTEAMENTO — REFERÊNCIA

| Token detectado na resposta do Claude | Módulos acionados | Resultado |
|--------------------------------------|-------------------|-----------|
| `[ESCALAR` | 6, 7 | Msg ao hóspede (sem token) + notificação à equipe |
| `[COTAR:` | 8, 9 | Extrai params por regex → chama `/quote` → envia cotação |
| `[CONFIRMAR:` | 10, 11 | Msg ao hóspede (sem token) + notificação à equipe com dados |
| *(sem token)* | 12 | Envia resposta diretamente ao hóspede |

---

## TROUBLESHOOTING

| Problema | Causa provável | Solução |
|---------|---------------|---------|
| Make.com não recebe mensagem | `MAKE_WEBHOOK_URL` não configurado ou Vercel não redeployado | Verificar Passo 6 |
| Claude retorna 401 | API key incorreta | Verificar `ANTHROPIC_API_KEY` no Make.com |
| WhatsApp não envia resposta (401) | Token de acesso inválido | Verificar `WHATSAPP_ACCESS_TOKEN` no Make.com |
| Airtable retorna 404 | Base ID ou nome da tabela incorretos | Verificar `AIRTABLE_BASE_ID` e nome exato "Conversas" |
| `/quote` retorna erro | Parâmetros do `[COTAR:]` mal extraídos | Ver logs do módulo 8 no Make.com |
| Luna não detecta ESCALAR/CONFIRMAR | Token ausente na resposta do Claude | Verificar se `SYSTEM_PROMPT` foi copiado completamente |
| Módulo 1 com erro após import | Webhook não conectado | Repetir Passo 3 |

---

## VARIÁVEIS — RESUMO CONSOLIDADO

### Vercel (`vercel.com → projeto → Settings → Environment Variables`)

| Variável | Status |
|----------|--------|
| `WHATSAPP_VERIFY_TOKEN` | ✅ Configurado |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ Configurado |
| `WHATSAPP_ACCESS_TOKEN` | ✅ Configurado |
| `MAKE_WEBHOOK_URL` | ⚠️ Configurar no Passo 6 |

### Make.com (`Team → Variables`)

| Variável | Status |
|----------|--------|
| `ANTHROPIC_API_KEY` | Passo 4 |
| `WHATSAPP_ACCESS_TOKEN` | Passo 4 |
| `WHATSAPP_PHONE_NUMBER_ID` | Passo 4 |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Passo 4 |
| `AIRTABLE_API_KEY` | Passo 4+5 |
| `AIRTABLE_BASE_ID` | Passo 4+5 |
| `EQUIPE_WHATSAPP_NUMBER` | Passo 4 (valor: `5519998400306`) |
| `SYSTEM_PROMPT` | Passo 4 (arquivo: `system-prompt.txt`) |

---

## MELHORIAS FUTURAS (PLU-01.3)

- [ ] Follow-up automático 2h pós-cotação sem resposta
- [ ] DeepSeek para FAQs simples (economia ~50% nos custos LLM)
- [ ] Histórico completo de conversa passado para o Claude (multi-turn context)
- [ ] Validação HMAC-SHA256 no webhook (QA-01 — PLU-01.1 T7)

---

## REFERÊNCIAS

- Blueprint: `docs/make-com/blueprint-pousada-atendimento.json`
- System prompt: `docs/make-com/system-prompt.txt`
- Webhook handler: `src/webhook/handler.js`
- Schema Airtable: `docs/architecture/airtable-schema.md`
- System prompt completo: `docs/architecture/claude-system-prompt.md`
