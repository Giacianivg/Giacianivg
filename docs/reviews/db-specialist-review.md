# Database Specialist Review — Fase 5
## Pousada Luz da Lua — Brownfield Discovery

**Versão:** 1.0
**Data:** 2026-02-24
**Autor:** Dara (@data-engineer) — Brownfield Discovery Fase 5
**Revisando:** `docs/prd/technical-debt-DRAFT.md` + `docs/data/DB-AUDIT.md` + `docs/data/SCHEMA.md` (v1.1)
**Status:** APROVADO COM RESSALVAS (2 novos débitos identificados, 2 ajustes de severidade)

---

## Resumo Executivo

O schema v1.1 proposto está **adequado para o MVP e para os épicos futuros PLU-04/05**, desde que criado com os campos novos desde o início. Os 10 débitos identificados na auditoria original (DB-AUDIT.md) foram validados — com 2 resolvidos, 2 com severidade ajustada e **2 novos débitos identificados** que não constavam no DRAFT.

**Decisão:** PROSSEGUIR com schema v1.1. Nenhum bloqueador novo encontrado. Os 2 novos débitos são endereçáveis dentro do sprint atual sem impacto no cronograma.

| Categoria | Resultado |
|-----------|-----------|
| Débitos originais validados | 10/10 ✅ |
| Resolvidos desde auditoria | 2 (DB-04, DB-05) ✅ |
| Severidade ajustada | 2 (DB-11↑, DB-12↑) |
| Novos débitos identificados | 2 (DB-11, DB-12) |
| Schema v1.1 adequado para MVP | ✅ SIM |
| Schema v1.1 adequado para PLU-04/05 | ✅ SIM (com condição menor) |
| Airtable correto para este caso | ✅ SIM (12-24 meses) |

---

## 1. Validação dos Débitos Originais

### 1.1 Débitos Confirmados — Sem Alteração

---

#### DB-01 — Overbooking: Campo `Reservadas` Manual

**Veredicto:** ✅ CONFIRMADO | Severidade: 🔴 CRÍTICO (mantida)

**Análise aprofundada:**
O risco de race condition é real mas com probabilidade baixa no contexto MVP. O fluxo é:

```
T=0ms: Hóspede A e B enviam "CONFIRMAR" simultaneamente
T=50ms: Make.com Instância 1 → busca Disponibilidade → vê 1 vaga → prossegue
T=50ms: Make.com Instância 2 → busca Disponibilidade → vê 1 vaga → prossegue
T=500ms: Instância 1 → cria Reserva A → decrementa Reservadas (1→1)
T=501ms: Instância 2 → cria Reserva B → decrementa Reservadas (1→0)
Resultado: 2 reservas para 1 quarto
```

**Probabilidade real:** BAIXA. Para o volume esperado (10-20 reservas/mês), a chance de dois hóspedes confirmarem exatamente o mesmo quarto/data no mesmo segundo é estatisticamente desprezível. O risco aumenta apenas durante promoções ou feriados de alta demanda.

**Mitigação recomendada (baixo custo):**
- Configurar Make.com scenario → Settings → `Max number of cycles` e verificar que "Sequential processing" está ativo (não paralelo)
- Isso garante que reservas são processadas uma a uma dentro do mesmo cenário

**Impacto sem correção:** Risco operacional aceitável para MVP, inaceitável em alta temporada com ocupação >70%.

---

#### DB-02 — Upsert por Telefone: Sem Deduplicação

**Veredicto:** ✅ CONFIRMADO | Severidade: 🔴 CRÍTICO (mantida)

**Análise aprofundada:**
O campo `Telefone` como chave de upsert é a abordagem correta para contexto WhatsApp. O número enviado pela Meta Cloud API é sempre o número E.164 registrado — sem variação de formato.

**Edge case documentado:**
Portabilidade de número: se um hóspede muda de número WhatsApp, aparece como novo lead. Frequência: rara. Ação: equipe pode fundir manualmente se identificado.

**Normalização defensiva recomendada no Make.com:**
```javascript
// Antes do Search Records, normalizar o número
telefone_normalizado = {{from}}.replace(/\D/g, '')
// Meta envia sem caracteres especiais, mas defensivo não custa nada
```

**Confirmação:** Não há campo adicional de deduplicação necessário. Telefone + contexto WhatsApp é suficiente.

---

#### DB-03 — PAT Airtable com Permissão Total

**Veredicto:** ✅ CONFIRMADO | Severidade: ⚠️ ALTO (mantida)

**Nota LGPD:** A correção DEVE ser feita ANTES de qualquer dado real de hóspede entrar no Airtable. Criar a base já com PAT correto é zero esforço adicional.

**Escopos corretos confirmados (per SCHEMA.md v1.1):**
```
data.records:read    — leitura (Conversas, Disponibilidade, Tabela de Preços, Reservas)
data.records:write   — escrita (Conversas, Disponibilidade, Reservas)
schema.bases:read    — estrutura (Make.com precisa para mapear campos)
```

**Tabelas:** Restringir ao base "Pousada Luz da Lua — CRM" apenas.

---

#### DB-06 — Tabela `Reservas` Inexistente

**Veredicto:** ✅ CONFIRMADO | Severidade: ⚠️ ALTO (mantida)

**Nota crítica de timing:** Esta tabela DEVE ser criada antes de qualquer reserva real ser confirmada. Migrar dados retroativamente de Conversas para Reservas é trabalhoso e propenso a erros. Custo agora: 1h. Custo depois de 50+ reservas: 5-8h + risco de perda.

**Schema v1.1 cobre isso adequadamente** — tabela Reservas definida com todos os campos necessários para PLU-04/05.

---

#### DB-07 — Campos Estruturados de Cotação Ausentes

**Veredicto:** ✅ CONFIRMADO | Severidade: ⚠️ ALTO (mantida)

**Dependência crítica:** DB-01 (automação de disponibilidade) NÃO FUNCIONA sem os campos `Data Entrada`, `Data Saída` e `Tipo Quarto` em Conversas. São pré-requisitos técnicos um do outro.

**Confirmação:** Schema v1.1 resolve com os 5 campos ⭐ adicionados em Conversas.

---

#### DB-08 — Campo `canal_origem` Ausente

**Veredicto:** ✅ CONFIRMADO | Severidade: 📋 MÉDIO (mantida)

**Nota operacional:** O preenchimento manual no MVP é aceitável, mas requer disciplina da equipe. Sugestão: criar um guia de 1 página explicando como identificar a origem do lead para o time de atendimento.

---

#### DB-09 — Sem Backup Automático

**Veredicto:** ✅ CONFIRMADO | Severidade: 📋 MÉDIO (mantida)

**Plano concreto:** Export semanal via Make.com → Google Drive. Custo: 0 operações adicionais (usando operações do plano já contratado). Implementar junto com o setup do Airtable.

---

#### DB-10 — Campo `Temporada` Redundante em Disponibilidade

**Veredicto:** ✅ CONFIRMADO | Severidade: 🔵 BAIXO (mantida)

**Recomendação final:** Manter o campo como **puramente informativo** (para visualização humana na interface do Airtable). Nunca usar como dado operacional em Make.com queries — sempre consultar Tabela de Preços para obter a temporada real.

---

### 1.2 Débitos Resolvidos (desde a auditoria)

| ID | Débito | Resolução | Data |
|----|--------|-----------|------|
| DB-04 | Regra de preço períodos mistos | **Option C — Prorateio por noite** decidido e documentado em SCHEMA.md | 2026-02-24 |
| DB-05 | Preços de alta temporada indefinidos | **R$400 casal + R$150/pessoa adicional** para todos os períodos de alta | 2026-02-24 |

---

## 2. Novos Débitos Identificados

> Estes débitos não constavam no DB-AUDIT.md original e foram identificados durante a revisão de Fase 5.

---

### DB-11 — Latência N×API na Cotação com Prorateio por Noite

**Severidade:** 📋 MÉDIO
**Área:** Performance / Integração
**Prioridade sugerida:** P2 — Pós-MVP (não bloqueia, mas afeta experiência)

**Problema:**
Com a regra de prorateio por noite (Option C), o cenário Make.com precisa consultar a Tabela de Preços para CADA noite da estadia separadamente. Uma estadia de 7 noites = 7 chamadas à API do Airtable apenas para precificação, mais 7 chamadas para verificação de disponibilidade = 14 chamadas no total.

```
Estadia 7 noites:
  Consulta disponibilidade: 7 × API call = ~700ms
  Consulta preço (prorateio): 7 × API call = ~700ms
  Total: ~1.4s apenas em chamadas Airtable
  + tempo Make.com processing + Claude API
  = cotação em ~3-5 segundos (limite de conforto UX: ~2s)
```

**Limitação Airtable API:** 5 requests/second por base. Para 14 chamadas sequenciais, há risco de rate limiting. Make.com pode ter que adicionar delay entre iterações.

**Solução recomendada (sem mudança de schema):**
A tabela `Disponibilidade` já possui o campo `Preço Base (R$)`. Usar este campo para obter o preço de cada noite **junto com a consulta de disponibilidade** — eliminando as 7 chamadas extras de preço:

```
PARA CADA noite do período:
  1x Query Disponibilidade → obtém: {Disponíveis} + {Preço Base}
  → Zero queries adicionais em Tabela de Preços para cotação
```

A Tabela de Preços seria consultada apenas para: (a) popular/atualizar Disponibilidade no início de cada temporada, e (b) validar mínimo de noites.

**Esforço:** 1h Make.com (ajuste no iterator do cenário de cotação).

---

### DB-12 — Validação de Mínimo de Noites Ausente no Fluxo de Cotação

**Severidade:** ⚠️ ALTO
**Área:** Regras de Negócio / Integridade
**Prioridade sugerida:** P1 — PLU-01.3 (deve ser implementado antes do lançamento)

**Problema:**
O campo `Mínimo de Noites` existe na tabela `Tabela de Preços`, mas o fluxo de cotação atual não verifica se a estadia solicitada atende ao mínimo. Cenário de risco:

```
Hóspede: "quero ficar dia 31/12 só uma noite"
Luna: consulta preço → R$400 disponível → [COTAR: data_entrada=31/12, noites=1]
Make.com: gera cotação → envia "Sua reserva de 1 noite: R$400"
Hóspede: confirma pagamento
Equipe: "Carnaval/Réveillon tem mínimo de 2 noites" → cancelamento forçado
```

**Impacto:** Dano à experiência do hóspede (cotação recebida e confirmada invalidada pela equipe), possível churn.

**Solução:**
No fluxo Make.com, após consultar o preço, adicionar validação:

```
IF numero_noites < minimo_noites THEN
  Luna responde: "Para o período de {{temporada}}, temos uma estada mínima
  de {{minimo_noites}} noites. Posso cotar a partir de {{data_entrada}}
  até {{data_entrada + minimo_noites}}? 😊"
ELSE
  Prosseguir com cotação normal
```

**Alternativamente:** Luna (no system prompt) pode já informar o mínimo ao perguntar as datas. Consultar @ux-design-expert para melhor abordagem conversacional.

**Esforço:** 1h Make.com + possível ajuste no system prompt da Luna (30min).

---

## 3. Respostas às Perguntas do @architect (Seção 6 do DRAFT)

---

### Pergunta 1: Schema v1.1 adequado para PLU-04 e PLU-05 sem refatoração major?

**Resposta: SIM — com uma ressalva menor.**

**PLU-04 (CRM/Retenção):** ✅ ADEQUADO
O schema v1.1 suporta os casos de uso de retenção:
- `Hóspede Retornou?` (Reservas) → taxa de retorno calculável
- `NPS` (Reservas) → score de satisfação por visita
- `Canal de Origem` (Conversas/Reservas via lookup) → segmentação para campanhas
- `Data Entrada/Saída` (Reservas) → timing de campanhas pós-estadia (ex: enviar follow-up 30 dias depois)

**PLU-05 (Analytics):** ✅ ADEQUADO para métricas core
- RevPAR: `Valor Total` (Reservas) ÷ `Total Unidades` × `Número de Noites` → calculável
- Taxa de ocupação: `Reservadas/Total` em `Disponibilidade` → calculável
- LTV por hóspede: soma de `Valor Total` por `ID_Conversa` → calculável
- CAC por canal: `canal_origem` disponível → calculável

**Ressalva menor para PLU-05:**
O schema não armazena o `Preço por Noite` unitário na cotação — apenas o `Valor Total`. Se a tabela de preços for alterada futuramente, não será possível recalcular qual tarifa foi aplicada em reservas históricas. Recomendo adicionar um campo `Preço Unitário Aplicado` (Currency) na tabela `Reservas` — custo: 15 minutos, valor: integridade histórica de pricing.

| Campo Adicional Sugerido | Tabela | Tipo | Impacto |
|--------------------------|--------|------|---------|
| `Preço Unitário Aplicado` | Reservas | Currency | Histórico de tarifas para PLU-05 |

---

### Pergunta 2: Upsert por Telefone é suficiente ou precisamos de campo adicional?

**Resposta: SUFICIENTE para o contexto WhatsApp. Nenhum campo adicional necessário.**

O identificador `from` do webhook Meta é o número E.164 registrado no WhatsApp. É estável, consistente e confiável como chave de negócio neste contexto:
- Meta não permite múltiplos WhatsApp para o mesmo número
- O número é verificado durante a ativação da conta WhatsApp
- Formato E.164 é padronizado pela plataforma (não varia entre mensagens do mesmo usuário)

**Único campo adicional sugerido (opcional):** `ID Meta` (String) — o `wa_id` enviado pelo webhook da Meta. É tecnicamente equivalente ao telefone E.164, mas registrá-lo separadamente protege contra mudanças de formato futuras da API. Baixíssima prioridade.

---

### Pergunta 3: Automação de decrementação (DB-01) é robusta? Existe risco de race condition?

**Resposta: EXISTÊNCIA CONFIRMADA do race condition. PROBABILIDADE BAIXA para MVP. MITIGAÇÃO SIMPLES disponível.**

**Análise técnica:**
Airtable não oferece transações atômicas via API REST. O padrão read-modify-write (ler Reservadas → incrementar → gravar) é inerentemente sujeito a race condition em ambiente concorrente.

**Cenário real de risco:**
- 2 hóspedes enviando "CONFIRMAR" para o mesmo quarto/data **no mesmo segundo**
- Make.com pode processar 2 instâncias em paralelo (dependendo da configuração)

**Probabilidade para este projeto:**
A pousada tem 18 quartos e processa ~10-20 reservas/mês. A probabilidade de 2 hóspedes confirmarem o mesmo quarto/data simultaneamente é estimada em <0,1% das transações. **Risco aceitável para MVP.**

**Mitigação de custo zero (implementar no PLU-01.3):**
```
Make.com → Cenário "Processar Confirmação" → Settings:
  Sequential processing: ON
  Max parallel executions: 1
```
Com isso, Make.com processa as confirmações em fila (uma por vez), eliminando a concorrência. Latência adicional: desprezível (fila quase sempre vazia dado o volume).

**Conclusão:** Implementar mitigação sequencial. Documentar o risco residual. Revisitar apenas se volume crescer para >100 reservas/mês.

---

### Pergunta 4: Airtable tem limitações de volume para os próximos 12-24 meses?

**Resposta: NÃO — dentro dos limites do plano Team ($20/mês).**

**Requisito imediato:** Plan **Team** (50.000 registros/base) — o plano Free (1.000 registros) é insuficiente mesmo para MVP.

**Projeção de volumes (24 meses):**

| Tabela | Crescimento | 12 meses | 24 meses |
|--------|------------|----------|----------|
| Conversas | ~50-100 leads/mês | ~600-1.200 | ~1.200-2.400 |
| Disponibilidade | 365 dias × 4 tipos (população inicial) | 1.460 | 2.920 |
| Tabela de Preços | ~20 registros/ano | ~40 | ~60 |
| Reservas | ~20-40 confirmações/mês | ~240-480 | ~480-960 |
| **Total** | | **~2.400-3.200** | **~4.700-6.400** |

**Margem:** 4.700-6.400 registros vs. limite de 50.000 = **87-91% abaixo do limite**. Sem risco de atingir o teto em 24 meses.

**API Rate Limits (5 req/seg):** Único ponto de atenção. Para cotações longas (>7 noites) com prorateio por noite, pode atingir o rate limit. Mitigação: DB-11 acima (usar `Preço Base` da Disponibilidade).

**Conclusão:** Airtable Team plan é suficiente para todo o horizonte do projeto. Reavaliar apenas se o projeto escalar para >200 reservas/mês.

---

### Pergunta 5: Há solução melhor que Airtable para este caso de uso no longo prazo?

**Resposta: Airtable é A SOLUÇÃO CORRETA para o MVP e para 12-24 meses. Migração prematura seria contra-produtiva.**

**Por que Airtable é correto agora:**
1. **Constraint real:** Equipe sem desenvolvedores. Airtable tem UI nativa que a gestão usa diretamente sem treinamento técnico
2. **Make.com integration:** Nativa, bem documentada, amplamente usada — sem curva de aprendizado
3. **Velocidade de setup:** 2-3h para criar o schema, populate, e conectar ao Make.com
4. **Custo:** R$100/mês (Team plan) — irrelevante para um negócio com R$30k/mês de receita

**Alternativas avaliadas:**

| Plataforma | Vantagens | Desvantagens | Decisão |
|-----------|-----------|--------------|---------|
| **Supabase** | Gratuito, SQL completo, sem limites de registros | Requer dev para admin UI, Make.com via HTTP (não nativo) | ❌ Prematuro sem dev |
| **Notion** | Interface mais intuitiva | Make.com integration inferior ao Airtable | ❌ Inferior para este uso |
| **Google Sheets** | Gratuito, familiar | Sem controle de acesso por coluna, sem tipos de campo | ❌ Risco de integridade |
| **Firebase/Firestore** | Escalável, gratuito | Requer dev, sem interface não-técnica | ❌ Fora do constraint |

**Gatilhos para reavaliar (12-18 meses):**
- Receita >R$80k/mês E contratação de desenvolvedor → Supabase + admin panel customizado
- Volume >5.000 conversas ativas → Ainda dentro do Airtable Team
- Necessidade de analytics avançado → Conectar Airtable a Metabase/Google Looker Studio (sem migrar o CRM)

**Recomendação:** Permanecer em Airtable. Priorizar velocidade de execução e estabilidade operacional sobre otimização prematura de infraestrutura.

---

## 4. Matriz de Débitos Atualizada

> Inclui ajustes de severidade e novos débitos DB-11/DB-12.

| ID | Débito | Severidade | Esforço | Sprint | Status |
|----|--------|-----------|---------|--------|--------|
| DB-01 | Automação disponibilidade (overbooking) | 🔴 Crítico | 2h Make.com | PLU-01.3 | Pendente |
| DB-02 | Upsert por telefone | 🔴 Crítico | 1h Make.com | PLU-01.2 | Pendente |
| DB-03 | PAT escopos mínimos | ⚠️ Alto | 30min | Setup | Pendente |
| DB-04 | Regra períodos mistos | — | — | — | ✅ Resolvido |
| DB-05 | Preços alta temporada | — | — | — | ✅ Resolvido |
| DB-06 | Tabela Reservas | ⚠️ Alto | 1h Airtable | Setup | Pendente |
| DB-07 | Campos estruturados cotação | ⚠️ Alto | 30min Airtable | Setup | Pendente |
| **DB-12** ⭐ | **Validação mínimo de noites no fluxo** | **⚠️ Alto** | **1h Make.com** | **PLU-01.3** | **Novo** |
| DB-08 | Campo canal_origem | 📋 Médio | 15min Airtable | Setup | Pendente |
| DB-09 | Backup semanal automático | 📋 Médio | 1h Make.com | Pós-MVP | Pendente |
| **DB-11** ⭐ | **Latência N×API para prorateio** | **📋 Médio** | **1h Make.com** | **Pós-MVP** | **Novo** |
| DB-10 | Campo Temporada redundante | 🔵 Baixo | 15min | Setup | Pendente |

**Contagem atualizada:** 12 débitos (10 originais - 2 resolvidos + 2 novos)
**Críticos:** 2 | **Altos:** 4 (+1) | **Médios:** 3 (+1) | **Baixos:** 1 | **Resolvidos:** 2

---

## 5. Recomendações Finais

### Prioridade P0 — Antes de criar o Airtable (impacto zero, custo zero)

1. **DB-03:** Gerar PAT com escopos mínimos desde o primeiro acesso. Nunca usar API key global.

### Prioridade P1 — No setup do Airtable (schema completo desde o início)

2. **DB-06 + DB-07 + DB-08:** Criar tabelas com schema v1.1 completo — incluir campos ⭐ e tabela Reservas desde o início. Retroativamente é 5x mais trabalhoso.
3. **Adição sugerida:** Campo `Preço Unitário Aplicado` na tabela Reservas (15min, preserva integridade histórica de pricing para PLU-05).
4. **DB-10:** Definir `Temporada` em Disponibilidade como informativo — nunca usar em Make.com queries.

### Prioridade P1 — PLU-01.2 e PLU-01.3

5. **DB-02:** Implementar upsert com `Search Records WHERE Telefone = from` antes de qualquer `Create Record`.
6. **DB-01 + DB-12:** Implementar juntos no fluxo de cotação/confirmação:
   - DB-12 primeiro: validar mínimo de noites ANTES de gerar cotação
   - DB-01: automação de decrementação quando status → "Reservado"
   - Configurar Make.com para processamento sequencial (concurrency=1)

### Prioridade P2 — Pós-MVP

7. **DB-11:** Otimizar cotação para usar `Preço Base` de Disponibilidade em vez de N queries em Tabela de Preços.
8. **DB-09:** Backup semanal automático via Make.com → Google Drive.

---

## 6. Questões Abertas para @architect

> Itens que requerem decisão arquitetural antes da implementação de Make.com.

| # | Questão | Impacto | Urgência |
|---|---------|---------|---------|
| A1 | O campo `Preço Base (R$)` em `Disponibilidade` deve ser mantido sincronizado com `Tabela de Preços` via Make.com automation, ou deve ser populado manualmente apenas no setup inicial? | Afeta DB-11 (solução de performance) | P2 |
| A2 | A validação de mínimo de noites (DB-12) deve ser tratada no system prompt da Luna ou no fluxo Make.com? | Impacta PLU-01.3 design | P1 |

---

## Histórico de Versões

| Data | Versão | Mudanças | Autor |
|------|--------|---------|-------|
| 2026-02-24 | 1.0 | Review inicial Fase 5 | Dara (@data-engineer) — Brownfield Discovery |
