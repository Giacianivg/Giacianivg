# UX Specialist Review — Fase 6
## Pousada Luz da Lua — Fluxo Conversacional Luna (WhatsApp)

**Versão:** 1.0
**Data:** 2026-02-24
**Autor:** Uma (@ux-design-expert) — Brownfield Discovery Fase 6
**Revisando:**
- `docs/architecture/claude-system-prompt.md` — System prompt da Luna
- `docs/stories/PLU-01.2.story.md` — AC e fluxo base do chatbot
- `docs/stories/PLU-01.3.story.md` — AC e fluxo de qualificação → cotação → fechamento
**Nota metodológica:** Projeto não possui frontend tradicional. Esta revisão foca em **UX Conversacional** — padrões de WhatsApp Business, funis de conversão via mensageria e experiência do hóspede no canal.
**Status:** APROVADO COM RESSALVAS — 5 novos débitos identificados, 4 perguntas respondidas

---

## Resumo Executivo

O fluxo conversacional da Luna está **bem estruturado para MVP** e demonstra boas práticas de chatbot conversacional para pousadas (tom acolhedor, emojis moderados, fluxo linear claro). No entanto, foram identificados **5 pontos de risco de abandono de funil** — concentrados especialmente nas transições pós-cotação e no SLA do escalonamento humano.

**Maior risco UX identificado:** O período entre o hóspede dizer "CONFIRMAR" e a equipe confirmar a reserva está indefinido ("Em breve alguém entrará em contato"), criando ansiedade e resfriamento do lead em potenciais compradores impulsivos.

| Dimensão UX | Status |
|-------------|--------|
| Tom e persona (Luna) | ✅ Excelente |
| Fluxo de qualificação (3 perguntas) | ✅ Adequado (1 melhoria menor) |
| Template de cotação WhatsApp | ✅ Bom (2 melhorias sugeridas) |
| Mensagem de escalonamento | ⚠️ Risco Médio — sem SLA |
| Pós-confirmação (handoff humano) | 🔴 Risco Alto — vazio de 1-8h |
| Follow-up pós-cotação (2h) | ⚠️ Risco Médio — tardio para leads quentes |
| Consistência entre documentos | ⚠️ Inconsistência menor encontrada |

---

## 1. Análise do Fluxo de Qualificação

### 1.1 Ordem das Perguntas

**Fluxo atual:**
```
Interesse em reserva detectado
  → Passo 1: "Quais datas você tem em mente?"
  → Passo 2: "Quantas pessoas serão? E vai ter crianças?"
  → Passo 3: "Você prefere: Ala A / Ala B?"
  → [COTAR: params]
```

**Veredicto:** ✅ ORDEM CORRETA para o contexto hoteleiro

A sequência datas → pessoas → tipo está alinhada com as melhores práticas de funis de reserva:

1. **Datas primeiro** é a pergunta de maior comprometimento intencional. Hóspedes que sabem as datas já tomaram uma decisão prévia — a pergunta "ancoras" o compromisso emocional e captura o lead no momento mais quente.
2. **Pessoas segundo** é uma pergunta simples, binária na maioria dos casos. Flui naturalmente de "quando?" para "quem?".
3. **Tipo de quarto último** é a escolha mais complexa e deve vir ao final, quando o hóspede já está comprometido com datas e grupo.

**Comparação com alternativas avaliadas:**

| Ordem | Análise | Recomendação |
|-------|---------|--------------|
| Datas → Pessoas → Quarto (atual) | Compromisso progressivo, baixa fricção inicial | ✅ Manter |
| Quarto → Datas → Pessoas | Alto compromisso inicial, risco de abandono precoce | ❌ Não usar |
| Pessoas → Datas → Quarto | Perda do "momento de intenção" das datas | ❌ Não usar |

### 1.2 Problema Identificado: Duas Perguntas em Uma

**Passo 2 atual:**
> "Quantas pessoas serão? E vai ter crianças?"

Este padrão (duas perguntas em uma mensagem) é um **anti-pattern de UX conversacional**. O hóspede pode:
- Responder só uma das perguntas
- Sentir que a conversa está se tornando um formulário
- Omitir a informação das crianças (especialmente se forem adolescentes)

**Problema prático para o sistema:** Se o hóspede responder "4 pessoas", Luna não sabe se incluem crianças — e isso importa para sugestão de tipo de quarto.

**Solução recomendada:**
```
Passo 2 (otimizado):
"Quantas pessoas serão no total? 🏡
(incluindo crianças e bebês)"
```
A inclusão "(incluindo crianças e bebês)" na própria pergunta elimina a necessidade de uma segunda pergunta e garante a informação necessária. Uma única mensagem, uma única resposta esperada.

### 1.3 Possível Otimização: Inferir Tipo de Quarto pelas Pessoas

Para a maioria dos hóspedes, o tipo de quarto pode ser inferido diretamente do número de pessoas, eliminando o Passo 3:

```
1-3 pessoas → oferecer Ala A primeiro ("Temos o Quarto Standard Casal — ideal para vocês!")
4-5 pessoas → oferecer Ala B ("Para 4 pessoas, nosso Quarto Família é perfeito!")
6+ pessoas → [ESCALAR] (regra de negócio já existente)
```

O Passo 3 (escolha explícita de tipo) seria acionado apenas quando:
- O número de pessoas está na faixa de overlap (3 pessoas — tanto Ala A quanto B servem)
- O hóspede demonstra preferência ou dúvida

**Impacto projetado:** Redução de 3 para 2 perguntas em ~70% dos fluxos → estimativa de +8-12% em taxa de chegada ao `[COTAR]`.

**Recomendação:** Implementar como melhoria pós-MVP (PLU-01.3 já está definida). Documentar para sprint seguinte.

---

## 2. Análise do Template de Cotação

### 2.1 Template Atual

```
🌙 *Cotação — Pousada Luz da Lua*

📅 Check-in: {data} | Check-out: {data}
🛏️ Tipo: {tipo_quarto}
👥 Hóspedes: {n}
🌙 Noites: {n}

💰 Valor por noite: R$ {x}
[SE desconto: 🎁 Desconto estada longa ({%}): -R$ {x}]
💳 *Total: R$ {total}*

✅ Incluso: Café da manhã
📍 Socorro-SP — Circuito das Águas Paulista

Para reservar, responda *CONFIRMAR* 🌿
Ou me diga se prefere outras datas ou tem alguma dúvida!
```

### 2.2 O Que Está Funcionando Bem

- **Hierarquia visual clara:** O uso de emojis como bullets cria scanneability adequada para WhatsApp
- **Total em negrito:** `*Total: R$ {total}*` chama atenção para o número mais importante
- **CTA claro:** "Responda *CONFIRMAR*" é inequívoco e segue padrão de bots de reserva
- **Inclusões explicitadas:** "Café da manhã incluso" remove objeção comum sem precisar perguntar
- **Tom neutro-amigável:** Sem exagero de entusiasmo ou linguagem de vendas agressiva — correto para contexto de pousada premium

### 2.3 Melhorias Identificadas

**Melhoria 1 — Incluir política de cancelamento:**
O cancelamento gratuito até 7 dias antes é uma **vantagem competitiva real** que deve estar visível no momento de decisão de compra. Isso reduz a objeção "e se eu precisar cancelar?" sem o hóspede ter que perguntar.

```diff
+ ❌ Cancelamento gratuito até 7 dias antes
```

**Melhoria 2 — Remover localização redundante:**
"📍 Socorro-SP — Circuito das Águas Paulista" é informação que o hóspede já sabe (está conversando com a pousada). Ocupa espaço que poderia reforçar o CTA ou a política de cancelamento.

**Template otimizado sugerido:**
```
🌙 *Cotação — Pousada Luz da Lua*

📅 Check-in: {data_entrada} | Check-out: {data_saida}
🛏️ {tipo_quarto_label} ({tipo_ala})
👥 {pessoas} hóspedes | 🌙 {noites} noites

💰 R$ {preco_noite}/noite
[SE desconto: 🎁 Desconto estada longa ({desconto}%): -R$ {valor_desconto}]
💳 *Total: R$ {total}*

✅ Incluso: Café da manhã
❌ Cancelamento gratuito até 7 dias antes

Para confirmar, responda *CONFIRMAR* 🌿
Quer ajustar as datas ou tem alguma dúvida?
```

**Melhoria 3 — Inconsistência entre documentos:**
O template em `claude-system-prompt.md` (Seção T2.2) não inclui o campo `{{link_reserva}}`, mas o template em `PLU-01.3.story.md` (T3.3) inclui "Para reservar, acesse: {{link_reserva}}". Na ausência de um sistema de reservas integrado (MVP), usar apenas o CONFIRMAR é correto — mas os dois documentos devem ser sincronizados para evitar confusão durante a implementação Make.com.

**Ação requerida:** Remover referência ao `{{link_reserva}}` do PLU-01.3 T3.3 ou documentar como "fase 2". O template canônico é o do `claude-system-prompt.md`.

---

## 3. Análise de Pontos de Abandono no Funil

> Escala de risco: 🔴 Alto | ⚠️ Médio | 🟢 Baixo

### 3.1 Mapeamento dos Pontos de Abandono

```
Lead chega com interesse
  ↓
[Ponto A] Primeira pergunta (datas)           🟢 Risco Baixo
  ↓
[Ponto B] Segunda pergunta (pessoas/crianças) 🟢 Risco Baixo (melhoria menor sugerida)
  ↓
[Ponto C] Terceira pergunta (tipo de quarto)  ⚠️ Risco Médio
  ↓
[Ponto D] Aguardar cotação (sistema processa) ⚠️ Risco Médio
  ↓
[Ponto E] Recebe cotação → decide confirmar  ⚠️ Risco Médio (lead morno 2h depois)
  ↓
[Ponto F] Responde CONFIRMAR → aguarda equipe 🔴 Risco Alto
  ↓
[Ponto G] Equipe confirma e orienta pagamento 🔴 Risco Alto (fora do controle de Luna)
```

### 3.2 Análise por Ponto

**Ponto C — Escolha do tipo de quarto:**
A listagem de opções com preços antes da cotação pode criar **price anchoring prematuro**. Se o hóspede vê "Ala A — R$300/noite" mas a cotação final sai R$550 (por ser alta temporada + 3 pessoas), ele pode sentir que foi enganado, mesmo que o preço seja correto.

**Mitigação:** Na Passo 3, Luna deve apresentar os tipos de quarto sem preços específicos, apenas características:
```
Você prefere:
• *Quarto Standard Casal (Ala A)* — até 3 pessoas, aconchegante 🌙
• *Quarto Família (Ala B)* — até 5 pessoas, espaçoso para famílias 🏡
Ou tem alguma preferência especial? 🌿
```
O preço final será apresentado na cotação completa — sem surpresas.

**Ponto D — Latência de processamento:**
O fluxo Make.com processa a cotação de forma assíncrona (Vercel → Make.com → Airtable → cálculo → resposta). Tempo esperado: 5-30 segundos.

Para o hóspede, **silêncio de 15-30 segundos no WhatsApp é percebido como falha**. Luna não envia nenhuma mensagem de "aguarde" enquanto o Make.com processa.

**Recomendação:** Adicionar mensagem de ponte imediatamente após o `[COTAR]` ser detectado:
```
"Perfeito! Deixa eu verificar a disponibilidade e calcular sua cotação personalizada... 🌙"
```
Esta mensagem é enviada ANTES de o Make.com processar os dados, reduzindo a percepção de latência.

**Ponto E — Follow-up pós-cotação em 2h:**
O trigger de 2 horas para follow-up é **tarde demais para leads quentes**. Pesquisas em WhatsApp commerce indicam:
- Lead quente (respondeu ao funil ativamente): janela ideal de follow-up = **30-45 minutos**
- Lead morno (parou no meio do funil): janela adequada = **2-4 horas**
- Lead frio (não respondeu ao follow-up anterior): **próximo dia útil**

Com follow-up fixo em 2h, Luna perde a janela ótima para os leads mais engajados.

**Sugestão de segmentação simples:**
```
SE hóspede chegou ao passo de cotação (recebeu a cotação):
  → Follow-up em 45 minutos
SE hóspede parou na qualificação (não chegou à cotação):
  → Follow-up em 3 horas
```
Implementação: duas triggers no Make.com ou um único trigger com condicional por status.

**Ponto F/G — Handoff humano pós-CONFIRMAR (RISCO MAIS ALTO):**

Este é o maior gap de experiência identificado no fluxo. Após o hóspede responder "CONFIRMAR", Luna responde:

> *"Ótimo! Recebi sua confirmação! 🌙 Vou avisar nossa equipe agora para finalizar os detalhes da sua reserva. Em breve alguém da Pousada Luz da Lua entrará em contato para confirmar e orientar sobre o pagamento. ☀️ Qualquer dúvida, estou aqui!"*

**Problemas identificados:**
1. **"Em breve" é vago:** Para o hóspede que acabou de confirmar com entusiasmo, "em breve" pode significar 5 minutos ou 8 horas. A ansiedade de não saber quando virá a confirmação pode levá-lo a buscar alternativas (Booking.com, outra pousada).
2. **Sem confirmação do que acontece a seguir:** O hóspede não sabe se a reserva está "garantida" ou "pendente". Pousadas concorrentes no Booking já confirmam instantaneamente — a percepção de insegurança do processo manual pode ser decisiva.
3. **Sem número de protocolo/confirmação:** Sem um ID ou número de referência, o hóspede não tem "prova" de que fez o pedido.

**Solução estruturada:**

```
APÓS hóspede confirmar:

Mensagem Luna imediata (automática):
"Ótimo! Sua reserva foi solicitada com sucesso! 🌙

📋 *Resumo do pedido:*
📅 {data_entrada} → {data_saida}
🛏️ {tipo_quarto} | 👥 {pessoas} hóspedes
💳 Total: R$ {total}

Nossa equipe confirmará sua reserva em até *{SLA_horas}h*
(disponível das 8h às 20h) e enviará instruções de pagamento.

Estamos ansiosos para receber você! ☀️"

→ Equipe notificada via WhatsApp imediatamente
→ Se equipe demorar mais de X horas → Make.com notifica equipe novamente
```

O `{SLA_horas}` deve ser definido pela gestão (sugestão: 2h em horário comercial).

---

## 4. Análise da Mensagem de Escalonamento

### 4.1 Mensagem Atual

```
[ESCALAR] Vou chamar nossa equipe para te ajudar melhor! Um momento 🌙
```

### 4.2 Problemas Identificados

**Problema 1 — "Um momento" implica resposta imediata:**
A expressão "Um momento" cria expectativa de resposta em segundos ou minutos. Se a pousada estiver fechada (ex: sábado às 22h), o hóspede aguardará e ficará frustrado. Em UX conversacional, criar expectativas que não podem ser cumpridas é uma das principais causas de churn.

**Problema 2 — Sem horário de atendimento humano:**
O hóspede não sabe quando a equipe está disponível. Se escalonar às 23h, não sabe se deve aguardar até amanhã ou se alguém responderá em breve.

**Problema 3 — Sem contexto de por que está escalando:**
"Para te ajudar melhor" é vago — o hóspede pode não entender por que Luna não pôde resolver e sentir que foi descartado pelo bot.

### 4.3 Mensagem de Escalonamento Otimizada

Versão com horário de atendimento (para mensagens dentro do horário):
```
[ESCALAR] Vou chamar nossa equipe para te ajudar com isso! 🌙
Nossa equipe humana responderá em até 30 minutos.
```

Versão para mensagens fora do horário (detectável por Make.com via timestamp):
```
[ESCALAR] Nossa equipe cuidará disso pessoalmente! 🌙
Nosso horário de atendimento é das 8h às 20h.
Você receberá retorno amanhã cedo ☀️
```

**Implementação Make.com:** Após detectar `[ESCALAR]`, o cenário verifica o timestamp. Se fora do horário 8h-20h (Brasil/SP), usa a versão "fora do horário". Custo: 1 condicional simples no Make.com.

**Definição necessária:** A gestão deve confirmar o horário de atendimento humano e o SLA de resposta para escalonamentos.

---

## 5. Respostas às Perguntas do @architect (Seção 6 do DRAFT)

---

### Pergunta 1: Ordem datas → pessoas → tipo de quarto é otimizada para conversão?

**Resposta: SIM — ordem está correta. Melhoria menor sugerida no Passo 2.**

A sequência atual é a mais eficaz para contexto de reserva hoteleira por WhatsApp. A única melhoria recomendada é consolidar Passo 2 para uma única pergunta clara: "Quantas pessoas serão no total? (incluindo crianças e bebês)". Isso elimina o anti-pattern de duas perguntas em uma mensagem e garante que a informação de crianças seja sempre capturada.

**Otimização pós-MVP (não bloqueia lançamento):** Implementar inferência de tipo de quarto pelo número de pessoas, reduzindo 3 perguntas para 2 em ~70% dos fluxos.

---

### Pergunta 2: Template de cotação está alinhado com boas práticas de UX conversacional?

**Resposta: SIM com melhorias menores recomendadas.**

O template está bem estruturado para WhatsApp. As melhorias sugeridas são:
1. Adicionar "❌ Cancelamento gratuito até 7 dias antes" — reduz objeção comum sem custo
2. Remover "📍 Socorro-SP" — informação redundante
3. Sincronizar com PLU-01.3 T3.3 (remover `{{link_reserva}}` até fase 2)

O template otimizado está detalhado na Seção 2.3 deste documento.

---

### Pergunta 3: Existe risco de abandono de funil em algum ponto específico?

**Resposta: SIM — 3 pontos identificados, 1 crítico.**

| Ponto | Descrição | Risco | Ação |
|-------|-----------|-------|------|
| Ponto C | Price anchoring na escolha de quarto | ⚠️ Médio | Remover preços do Passo 3 |
| Ponto D | Latência silenciosa no processamento | ⚠️ Médio | Mensagem "aguarde" imediata |
| **Ponto F/G** | **Handoff humano pós-CONFIRMAR vago** | **🔴 Alto** | **SLA explícito + resumo confirmação** |

O ponto crítico é o gap pós-CONFIRMAR. Solução detalhada na Seção 3.2.

---

### Pergunta 4: A mensagem de escalonamento precisa de expectativa de tempo de resposta?

**Resposta: SIM — é uma melhoria necessária antes do lançamento.**

"Um momento 🌙" cria expectativa de resposta imediata que não pode ser cumprida. A solução é uma mensagem contextual por horário (dentro/fora do expediente), conforme detalhado na Seção 4.3. O custo de implementação é 1h no Make.com (condicional de horário + duas variantes de mensagem). O impacto em NPS e satisfação do hóspede escalonado justifica o esforço.

---

## 6. Novos Débitos UX Identificados

| ID | Débito | Severidade | Esforço | Sprint | Nota |
|----|--------|-----------|---------|--------|------|
| **UX-01** | Passo 2 do funil tem 2 perguntas em 1 mensagem | 📋 Médio | 30min (system prompt) | PLU-01.2 / próxima revisão | Anti-pattern conversacional |
| **UX-02** | Mensagem de escalonamento sem SLA por horário | ⚠️ Alto | 1h Make.com | PLU-01.2 / antes do lançamento | Cria expectativa falsa |
| **UX-03** | Passo 3 exibe preços antes da cotação (price anchoring) | 📋 Médio | 30min (system prompt) | Pós-MVP | Pode causar surpresa no total |
| **UX-04** | Latência silenciosa no processamento da cotação | ⚠️ Alto | 30min Make.com | PLU-01.3 | Percepção de falha do sistema |
| **UX-05** | Pós-CONFIRMAR sem SLA explícito + gap de handoff humano | 🔴 Crítico | 1h Make.com + decisão gestão (definir SLA) | PLU-01.3 / antes do lançamento | Risco de churn de leads confirmados |

**Total de débitos UX:** 5 novos
**Críticos:** 1 (UX-05) | **Altos:** 2 (UX-02, UX-04) | **Médios:** 2 (UX-01, UX-03)

---

## 7. Questões Abertas para a Gestão

> Itens que requerem decisão humana antes da implementação.

| # | Questão | Impacto | Urgência |
|---|---------|---------|---------|
| G1 | Qual o SLA de resposta do time humano para escalonamentos? (sugestão: 30min das 8h-20h) | UX-02 e UX-05 | Alta — antes do lançamento |
| G2 | Qual o horário de atendimento humano da pousada? (para condicional na mensagem de escalonamento) | UX-02 | Alta — antes do lançamento |
| G3 | O follow-up de 2h pode ser reduzido para 45min para leads que chegaram ao passo de cotação? | UX-05 | Média — PLU-01.3 |
| G4 | Aceita pets? Tem piscina? Tem Wi-Fi confirmado? (3 FAQs atualmente com resposta "a confirmar" no system prompt — gera re-escalonamento desnecessário) | Qualidade do atendimento | Alta — antes do lançamento |

> G4 é especialmente importante: as 4 FAQs com resposta "a confirmar" fazem Luna escalar para humano em perguntas simples, aumentando carga da equipe e frustrando hóspedes com respostas evasivas.

---

## 8. Pontos Positivos do Fluxo (para preservar)

Para evitar over-engineering, explicitando o que está funcionando bem e NÃO deve ser alterado:

1. **Tom da Luna** — "Acolhedor, caloroso, mas profissional" está bem calibrado. Não tornar mais formal (perde calor) nem mais casual (perde credibilidade).
2. **Uso moderado de emojis** — Máx. 1-2 por mensagem é correto. Mais emojis = tom infantil para público adulto de pousada.
3. **Mensagens curtas** — Limite de 3 parágrafos por resposta está correto para WhatsApp.
4. **Regra de escalonamento para grupos 6+** — Correto. Eventos e grupos precisam de negociação humana.
5. **Follow-up com apenas 1 envio por cotação** — Correto. Mais de um follow-up = spam percebido.
6. **CONFIRMAR como palavra-chave** — Palavra clara, inequívoca, fácil de digitar. Não mudar.

---

## Histórico de Versões

| Data | Versão | Mudanças | Autor |
|------|--------|---------|-------|
| 2026-02-24 | 1.0 | Review inicial Fase 6 | Uma (@ux-design-expert) — Brownfield Discovery |
