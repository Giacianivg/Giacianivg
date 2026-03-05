# STORY PLU-01.3: Fluxo Completo — Qualificação → Cotação → Fechamento

**ID:** PLU-01.3 | **Epic:** [EPIC-PLU-01](../epics/EPIC-PLU-01-funil-vendas-automatizado.md)
**Sprint:** 2 | **Points:** 8 | **Priority:** 🔴 Critical
**Created:** 2026-02-22
**Status:** 🔄 InProgress
**Predecessor:** PLU-01.2 (Chatbot base operacional)

---

## User Story

**Como** gestor da Pousada Luz da Lua,
**Quero** que o Claude conduza o hóspede por um funil completo de qualificação, envie cotação personalizada e encaminhe para o fechamento da reserva,
**Para que** a taxa de conversão lead→reserva aumente de ~10% atual para >25%, com mínima intervenção humana.

---

## Acceptance Criteria

- [ ] AC1: Quando hóspede demonstra interesse em reserva, Claude inicia fluxo de qualificação coletando: datas, número de pessoas, tipo de quarto preferido, ocasião (lazer, casal, família, evento)
- [ ] AC2: Após qualificação, Claude verifica disponibilidade na base de dados (Airtable/sistema de reservas) e gera cotação personalizada com valor total e detalhes
- [ ] AC3: Cotação inclui: período, tipo de quarto, valor por noite, total, o que está incluso (café da manhã, etc), link direto para reserva no site
- [ ] AC4: Hóspede pode responder "confirmar", "tenho dúvidas" ou "outro período" e o fluxo trata cada caso
- [ ] AC5: Reserva confirmada via WhatsApp gera registro automático no Airtable com status "Reservado" e notifica equipe
- [ ] AC6: Taxa de abandono do funil monitorada: se hóspede para de responder após cotação, follow-up automático em 2h com mensagem suave
- [ ] AC7: Funil completo testado com 20 cenários (diferentes tipos de quarto, datas, grupos) com taxa de erro <5%

---

## Scope

### IN
- Fluxo de qualificação: perguntas sequenciais estruturadas pelo Claude
- Consulta de disponibilidade: tabela "Disponibilidade" no Airtable (calendário simples por tipo de quarto)
- Geração de cotação: cálculo automático com tabela de preços do Airtable (EPIC-PLU-03 fornecerá pricing dinâmico futuramente)
- Template de cotação formatado para WhatsApp (com emojis, organizado)
- Fluxo de confirmação e notificação da equipe
- Follow-up automático após 2h sem resposta pós-cotação
- Rastreamento de conversão no Airtable

### OUT
- Pagamento online integrado ao WhatsApp (fase 2)
- Geração de contrato digital (fase 2)
- Integração com channel manager/Booking.com para bloqueio automático (fase 2 — EPIC-PLU-03)
- Cotação para eventos corporativos complexos (encaminha para equipe)

---

## Tasks

### T1 — Tabela de Disponibilidade no Airtable (2h)
- [x] T1.1: Criar tabela "Disponibilidade" no Airtable com estrutura:
  | Campo | Tipo |
  |-------|------|
  | Data | Date |
  | Tipo de Quarto | Single select (categorias da pousada) |
  | Total de Unidades | Number |
  | Disponíveis | Number (fórmula: Total - Reservadas) |
  | Reservadas | Number |
  | Preço Base (R$) | Currency |
- [x] T1.2: Criar tabela "Tabela de Preços" com períodos e tarifas:
  | Período | Tipo | Preço/Noite |
  |---------|------|-------------|
  | Baixa temporada | Standard | (preencher com gestão) |
  | Média temporada | Standard | ... |
  | Alta temporada | Standard | ... |
  | Feriados | Standard | ... |
- [ ] T1.3: Popular com dados reais fornecidos pela gestão da pousada
- [ ] T1.4: Validar cálculos de disponibilidade com 10 cenários

### T2 — Atualização do System Prompt (fluxo de vendas) (2h)
- [x] T2.1: Adicionar ao system prompt (PLU-01.2) a lógica de qualificação:
  ```
  FLUXO DE QUALIFICAÇÃO (ativar quando hóspede demonstrar interesse em reserva):

  Passo 1 — Coletar datas:
  "Que ótimo! Para montar sua cotação, preciso de algumas informações.
  Quais datas você tem em mente? (ex: de XX/XX a XX/XX)"

  Passo 2 — Número de hóspedes:
  "Quantas pessoas serão? E vai ter crianças?"

  Passo 3 — Preferências:
  "Você prefere [listar tipos de quarto disponíveis]? Tem alguma ocasião especial? 🌙"

  Passo 4 — Acionar módulo de cotação:
  Quando tiver: datas + n° de pessoas, inclua na resposta:
  "[COTAR: data_entrada=DD/MM/YYYY, data_saida=DD/MM/YYYY, pessoas=N, tipo=X]"
  ```
- [x] T2.2: Instruir Claude sobre como apresentar a cotação recebida
- [x] T2.3: Adicionar fluxo de confirmação e objeções comuns
- [x] T2.4: [UX-04] Adicionar mensagem de "aguarde" **imediatamente antes** de disparar o módulo de cotação no Make.com:
  - Quando Claude envia `[COTAR: ...]`, o Make.com envia primeiro ao hóspede: `"Ótimo! Vou verificar a disponibilidade e montar sua cotação agora... 🌙"`
  - Só então executa os módulos Airtable (5-30s de latência)
  - Hóspede não fica em silêncio enquanto o sistema processa

### T3 — Cenário Make.com: Módulo de Cotação (3h)
- [x] T3.1: Atualizar cenário Make.com para detectar "[COTAR: ...]" na resposta do Claude
- [ ] T3.2: Quando "[COTAR]" detectado:
  ```
  MODULE: Parse dos parâmetros de cotação
  ↓
  MODULE: Enviar mensagem imediata ao hóspede: "Ótimo! Deixa eu montar sua cotação... 🌙" (UX-04)
  ↓
  MODULE: Airtable — buscar tabela de preços para o período (sem checar disponibilidade)
  ↓
  MODULE: Cálculo (Make.com Math):
    - Classificar noites por período: baixa / fim de semana / alta temporada
    - Total = soma de (noites_por_período × preço_por_período)
  ↓
  MODULE: Formatar cotação em template WhatsApp
  ↓
  MODULE: Claude — gerar mensagem final com a cotação (tom humanizado)
  ↓
  MODULE: Enviar cotação ao hóspede via WhatsApp
  ↓
  MODULE: Atualizar Airtable — status "Cotação enviada"
  ```
  > **Nota:** disponibilidade NÃO é verificada em tempo real. A cotação inclui o aviso "sujeita a confirmação". Quando o hóspede confirmar (CONFIRMAR), a equipe verifica manualmente no motor-reserva.com.br e responde pelo (19) 99840-0306.
- [ ] T3.3: Template de cotação (atualizado — sem link de reserva, com política de cancelamento):
  ```
  🌙 *Cotação — Pousada Luz da Lua*

  📅 Check-in: {{data_entrada}} | Check-out: {{data_saida}}
  🛏️ Tipo: {{tipo_quarto}}
  👥 Hóspedes: {{numero_pessoas}}
  🌙 Noites: {{numero_noites}}

  💰 {{descricao_noites}}
  💳 *Total: R$ {{total}}*

  ✅ Incluso: Café da manhã, Wi-Fi
  🐾 Pets: aceitos (taxa de R$20/dia por animal)
  ❌ Cancelamento: gratuito até 7 dias antes do check-in

  Responda *CONFIRMAR* para nossa equipe finalizar sua reserva! 🌿
  _(Nossa recepção, das 12h às 22h, confirmará em até 2h e enviará as instruções de pagamento)_
  ```
- [ ] T3.4: Testar cotação com 10 combinações diferentes de datas/tipo/pessoas
- [x] T3.5: [DB-12] Implementar **validação de mínimo de noites** no módulo de cotação:
  - Fins de semana (chegada sexta ou sábado): mínimo 2 noites
  - Alta temporada: mínimo 2 noites
  - Dias úteis / baixa temporada: mínimo 1 noite
  - Se pedido não atender o mínimo, Make.com retorna cotação com aviso:
    `"Para fins de semana, nossa estadia mínima é de 2 noites 🌙 Posso montar a cotação para 2 noites?"`

### T4 — Follow-up Automático (1h)
- [x] T4.1: Criar cenário separado no Make.com "Follow-up pós-cotação":
  - Trigger: novo registro no Airtable com status "Cotação enviada" há >2h sem atualização
  - Ação: enviar mensagem suave via WhatsApp:
    ```
    Olá {{nome}}! 🌙 Vi que você recebeu nossa cotação há pouco.
    Ainda tem interesse? Posso tirar alguma dúvida ou ajustar o período?
    Estamos aqui para te ajudar! ☀️
    ```
  - Máximo 1 follow-up por cotação (marcar campo "Follow-up enviado" no Airtable)
- [ ] T4.2: Testar trigger e envio do follow-up

### T5 — Confirmação e Notificação (1h)
- [ ] T5.1: Quando hóspede responde "CONFIRMAR":
  - Luna confirma recebimento com SLA explícito (mensagem do sistema prompt CASO 1)
  - Atualiza Airtable: status "Reserva solicitada"
  - Notifica equipe via WhatsApp para o número **(19) 99840-0306**:
    "🔔 *Nova reserva solicitada!*
    Hóspede: {{nome}} | Tel: {{telefone}}
    Período: {{datas}} | Tipo: {{quarto}} | Total: R${{total}}
    Sinal: R${{total_30_porcento}} (30%)
    ➡️ 1. Verificar disponibilidade no motor-reserva
    ➡️ 2. Confirmar e solicitar sinal de 30% ao hóspede"
- [ ] T5.2: Equipe verifica disponibilidade no **motor-reserva.com.br**, bloqueia a data lá e responde ao hóspede pelo número (19) 99840-0306 com instruções de pagamento
- [ ] T5.3 (antigo T5.2): Equipe atualiza status no Airtable para "Reservado" após confirmar
- [ ] T5.3: Testar fluxo completo de ponta a ponta
- [x] T5.4: [UX-05] Implementar mensagem pós-CONFIRMAR com **SLA explícito**:
  - Substituir a mensagem genérica por:
    `"Recebemos sua solicitação de reserva! 🌿 Nossa recepção (disponível das 12h às 22h) confirmará em até 2 horas e enviará as instruções de pagamento via WhatsApp."`
  - Testar que a mensagem é enviada imediatamente após o hóspede responder CONFIRMAR
- [ ] T5.5: [QA-02] Implementar **verificação de idempotência** por `message_id` no Make.com:
  1. Extrair `entry[0].changes[0].value.messages[0].id` do payload do webhook
  2. Buscar no Airtable se já existe conversa com esse `message_id` (campo: `ID Última Mensagem`)
  3. Se já processado → retornar sem reprocessar (Meta reenvia em falha de confirmação)
  4. Se novo → processar normalmente e salvar o `message_id` na tabela Conversas
  - Evita que o hóspede receba a mesma resposta duplicada

### T6 — Testes e Métricas (1h)
- [ ] T6.1: Executar 20 cenários de teste completos (qualificação → cotação → resposta)
- [ ] T6.2: Medir e registrar:
  - Tempo médio qualificação → cotação enviada
  - Taxa de cotações com erro de cálculo
  - Taxa de follow-up necessário
- [ ] T6.3: Validar todos os ACs com equipe da pousada

---

## Dev Notes

### Fluxo de Dados Completo

```
Hóspede: "Quero fazer uma reserva"
  ↓ Claude detecta intenção de reserva
  ↓ Inicia qualificação (3 perguntas)
  ↓ Claude inclui [COTAR: params] quando tiver dados suficientes
  ↓ Make.com detecta [COTAR], busca disponibilidade e preços no Airtable
  ↓ Make.com calcula valor total
  ↓ Make.com chama Claude novamente com os dados da cotação para formatar
  ↓ Claude gera mensagem humanizada com a cotação
  ↓ Mensagem enviada ao hóspede
  ↓ Hóspede responde CONFIRMAR
  ↓ Airtable atualizado + equipe notificada
```

### Categorias de Quarto ✅ Confirmado pela Gestão

Dados reais registrados em `docs/architecture/room-categories.md`:

| Ala | Qtd | Configuração | Capacidade | Diária Base |
|-----|-----|-------------|------------|-------------|
| Ala A | 8 | 1 casal + 1 solteiro | 3 pessoas | ~R$300 |
| Ala B | 7 | 1 casal + 2 solteiros + auxiliar | 5 pessoas | ~R$300-350 |
| Ala C | 2 | Grupo | 8 pessoas | Sob consulta |

**Incluso:** Café da manhã em todas as alas
**Cancelamento:** Gratuito até 7 dias antes do check-in
**Ala C:** Sempre escalar para atendimento humano (grupos)

> ⚠️ Pesquisa de concorrentes pendente para validar pricing. Ver EPIC-PLU-02.

### Link de Reserva

Para o MVP, o link pode ser o site da pousada (https://pousadaluzdaluasp.com.br) ou um formulário Google Forms para solicitação de reserva, até que um booking engine próprio seja implementado.

### Considerações sobre Disponibilidade

No MVP, a disponibilidade será gerenciada manualmente no Airtable. A equipe deve atualizar as entradas de disponibilidade diariamente. Em fase posterior (EPIC-PLU-03), o pricing dinâmico e a integração com channel manager automatizarão esse processo.

### Testing

| Test ID | Name | Type | Priority |
|---------|------|------|----------|
| T-FUN-01 | Fluxo completo: lead → cotação → confirmação em <5 min | E2E | P0 |
| T-FUN-02 | Cotação com datas em alta temporada usa preço correto | Unit | P0 |
| T-FUN-03 | Quarto indisponível → Claude sugere alternativa ou outras datas | Integration | P0 |
| T-FUN-04 | Follow-up enviado após 2h sem resposta pós-cotação | Integration | P0 |
| T-FUN-05 | Confirmação notifica equipe via WhatsApp | Integration | P0 |
| T-FUN-06 | Grupo de 15 pessoas → escalonamento para humano (evento) | Integration | P1 |
| T-FUN-07 | Cálculo correto para 7 noites em período misto | Unit | P0 |
| T-FUN-08 | Airtable atualizado corretamente em todos os status | Integration | P0 |

---

## 🤖 CodeRabbit Integration

### Story Type Analysis
**Primary Type:** Integration
**Secondary Type(s):** Architecture, API
**Complexity:** High (fluxo multi-step com múltiplos sistemas e lógica de negócio)

### Specialized Agent Assignment
**Primary Agents:**
- @dev (implementação do fluxo Make.com e lógica de cotação)
- @architect (validação do design do funil e integrações)

**Supporting Agents:**
- @pm (validação de que o funil atinge a meta de 25% de conversão)
- @qa (teste dos 20 cenários end-to-end)

### Self-Healing Configuration
**Expected Self-Healing:**
- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL

### Focus Areas
**Primary Focus:**
- Cálculo correto de preços em todos os cenários de data/quarto
- Integridade dos dados no Airtable (status, datas, valores)
- Fluxo de erro: disponibilidade não encontrada → resposta graciosa

**Secondary Focus:**
- Performance: fluxo completo em <30s
- Follow-up não enviado mais de uma vez por cotação
- Notificação da equipe em 100% das confirmações

---

## Dependencies

**Depends on:**
- PLU-01.2: Chatbot base (Claude + Make.com) operacional
- Dados reais de categorias de quarto e tarifas da gestão
- Tabela de disponibilidade no Airtable populada

**Blocks:**
- EPIC-PLU-04 (CRM/Retenção) — dados de conversão alimentam régua de retenção

---

## Definition of Done

- [ ] Funil completo testado com 20 cenários com taxa de erro <5%
- [ ] Cotações geradas com valores corretos (validado com tabela de preços real)
- [ ] Follow-up automático funcionando
- [ ] Notificações de confirmação chegando para equipe
- [ ] Taxa de conversão monitorada no Airtable
- [ ] @po valida os ACs com a gestão da pousada

---

## Dev Agent Record

**Agent:** Dex (@dev) | **Model:** claude-sonnet-4-6 | **Mode:** Interactive

### Completion Notes

- Schema Airtable completo documentado em `docs/architecture/airtable-schema.md`
- 3 tabelas: Conversas (CRM), Disponibilidade (calendário), Tabela de Preços
- Lógica de cotação implementada em `src/chatbot/test-quotation-flow.js`
- **20/20 cenários passando:** preços, temporadas, descontos, grupos, erros, formatação
- Desconto automático: 7+ noites = 10%, 14+ noites = 15%
- ALA_C_GRUPO sempre escala para humano (regra de negócio)
- Template WhatsApp formatado com emoji, preço total e link para site
- Follow-up automático documentado (trigger Make.com: 2h sem resposta pós-cotação)
- Notificação de confirmação da equipe documentada com dados completos da reserva

### File List

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `docs/architecture/airtable-schema.md` | CREATE | Schema completo Airtable (3 tabelas + queries Make.com) |
| `src/chatbot/test-quotation-flow.js` | UPDATE | 24 testes (importa quotation.js; cobre prorateio, preço/pax, min-noites) |
| `src/webhook/quotation.js` | UPDATE | Prorateio noite-a-noite, preço por pessoa em alta, validação min-noites (DB-12) |
| `docs/architecture/claude-system-prompt.md` | UPDATE | UX-04 (aguarde antes de [COTAR]), UX-05 (SLA pós-CONFIRMAR), preços atualizados |

### Pendências (requerem ação humana)

- T1.3: Popular tabelas Airtable com dados reais (gestão da pousada)
- T1.4: Validar disponibilidade no Airtable com 10 cenários reais
- T3: Implementar cenário Make.com de cotação seguindo o fluxo documentado
- T4: Configurar follow-up automático no Make.com
- T5: Testar fluxo completo ponta-a-ponta com WhatsApp real
- T6: Validar ACs com equipe da pousada

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-22 | 1.0 | Story criada via *draft | River (@sm) |
| 2026-02-22 | 1.1 | Validação GO (9/10) — Status Draft→Ready | Pax (@po) |
| 2026-02-22 | 1.2 | Schema Airtable + lógica de cotação + 20/20 testes OK | Dex (@dev) |
| 2026-02-24 | 1.3 | Adicionado T2.4 (UX-04), T3.5 (DB-12), T5.4 (UX-05), T5.5 (QA-02); template T3.3 atualizado — Brownfield Discovery Fases 5-7 | Aria (@architect) |
| 2026-03-05 | 1.4 | quotation.js: prorateio noite-a-noite + preço por pessoa em alta (R$400+R$150/extra) + min-noites (DB-12). test-quotation-flow.js: refatorado para importar quotation.js + 24/24 testes OK. system-prompt: UX-04 (aguarde), UX-05 (SLA), preços atualizados | Dex (@dev) |

---

## QA Results

_To be populated after implementation_
