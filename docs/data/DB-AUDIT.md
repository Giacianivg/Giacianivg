# Airtable — Auditoria de Dados
## Pousada Luz da Lua — CRM

**Versão:** 1.0
**Data:** 2026-02-23
**Autor:** Aria (@architect) — Brownfield Discovery Fase 2 (simplificada)
**Perspectiva:** @data-engineer
**Fonte:** `docs/architecture/airtable-schema.md` + stories PLU-01.2 e PLU-01.3
**Status da Base:** Não criada ainda (schema documentado, aguarda setup humano)

---

## Resumo Executivo

O schema Airtable documentado é **funcional para o MVP** mas apresenta **riscos críticos de integridade de dados** que podem resultar em overbooking e perda de dados analíticos valiosos. As principais lacunas são: ausência de relacionamentos entre tabelas, gestão manual de disponibilidade sem validação, e campos de cotação não estruturados.

| Categoria | Status |
|-----------|--------|
| Controle de Acesso (RLS equiv.) | ⚠️ Risco Alto |
| Índices / Performance | ⚠️ Risco Médio |
| Relacionamentos / Integridade | 🔴 Risco Crítico |
| Completude para MVP | ✅ Adequado |
| Completude para Épicos Futuros | ⚠️ Gaps Identificados |
| Estratégia de Backup | 🔴 Inexistente |

---

## Schema Atual — Inventário de Tabelas

### Tabela 1: `Conversas` (CRM de Leads)

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| ID | Auto number | Auto | Identificador único |
| Nome do Hóspede | Single line text | Não | Coletado durante conversa |
| Telefone | Phone number | **Sim** | Chave primária lógica (E.164) |
| Data Primeiro Contato | Date | Auto | Timestamp do primeiro contato |
| Última Mensagem | Date | Auto | Timestamp da última interação |
| Resumo da Conversa | Long text | Não | Gerado pelo LLM |
| Status | Single select | **Sim** | Novo / Em atendimento / Cotação enviada / Reserva solicitada / Reservado / Encerrado |
| Escalonado? | Checkbox | Auto | Se [ESCALAR] foi acionado |
| Modelo LLM Usado | Single select | Auto | Claude / DeepSeek / Misto |
| Follow-up Enviado? | Checkbox | Auto | Controle do follow-up (PLU-01.3) |
| Data Cotação Enviada | Date | Auto | Timestamp da cotação |
| Observações | Long text | Não | Notas manuais |

**Campos ausentes identificados (ver DB-GAP-03):**
- `data_entrada`, `data_saida` — datas da reserva solicitada
- `tipo_quarto` — ala selecionada na cotação
- `numero_pessoas` — hóspedes na cotação
- `valor_cotacao` — valor total cotado
- `canal_origem` — origem do lead (Meta Ads, orgânico, Google…)

---

### Tabela 2: `Disponibilidade` (Calendário de Ocupação)

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| Data | Date | **Sim** | Data específica |
| Tipo de Quarto | Single select | **Sim** | ALA_A / ALA_B / ALA_C_GRUPO / ALA_C_CASAL |
| Total de Unidades | Number | **Sim** | Total de quartos desse tipo |
| Reservadas | Number | **Sim** | Atualização **manual** — risco alto |
| Disponíveis | Formula | Auto | `{Total} - {Reservadas}` |
| Preço Base (R$) | Currency | **Sim** | Preço para aquela data/tipo |
| Temporada | Single select | Não | Baixa / Média / Alta / Feriado |
| Notas | Single line text | Não | Observações especiais |

**Problema crítico:** Campo `Reservadas` requer atualização manual. Sem automação de decrementação quando uma reserva é confirmada.

---

### Tabela 3: `Tabela de Preços` (Tarifas por Temporada)

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| Temporada | Single select | Sim | Nome da temporada |
| Tipo de Quarto | Single select | Sim | ALA_A / ALA_B / ALA_C_CASAL |
| Preço por Noite | Currency | Sim | R$ |
| Mínimo de Noites | Number | Sim | Ex: 2 no fds, 3 no Carnaval |
| Período Início | Date | Sim | Início do período |
| Período Fim | Date | Sim | Fim do período |
| Ativo? | Checkbox | Sim | Se a tarifa está vigente |

**Dados incompletos:** Preços de alta temporada e feriados ainda indefinidos — aguardando pesquisa competitiva (EPIC-PLU-02).

---

## Achados de Auditoria

### 🔴 CRÍTICOS

---

#### DB-CRIT-01: Risco de Overbooking por Ausência de Automação de Disponibilidade

**Problema:**
O campo `Reservadas` na tabela `Disponibilidade` é atualizado **manualmente** pela equipe. Quando o status de uma Conversa muda para `Reservado`, o Airtable não decrementa automaticamente o campo `Reservadas`.

**Cenário de risco:**
1. Lead A solicita Ala A para 15/03 → equipe não atualiza `Reservadas` imediatamente
2. Lead B também cotam Ala A para 15/03 → sistema diz "disponível" → cotação enviada
3. Ambos confirmam → overbooking

**Impacto:** Alto. Dano direto à reputação e operação.

**Recomendação:**
Criar automação Make.com (ou Airtable Automation nativa):
```
TRIGGER: Status da Conversa muda para "Reservado"
  ↓
ACTION: Buscar registro em Disponibilidade
  WHERE: Data = data_entrada E Tipo = tipo_quarto
  ↓
ACTION: Incrementar campo {Reservadas} + 1
  (para cada noite do período)
```
> Requer adicionar campos estruturados `data_entrada`, `data_saida`, `tipo_quarto` em Conversas (ver DB-GAP-03).

---

#### DB-CRIT-02: Ausência de Chave Primária Natural Única em `Conversas`

**Problema:**
O campo `Telefone` é a chave de identificação lógica do contato, mas o Airtable não impõe unicidade. É possível criar múltiplos registros para o mesmo número de telefone, especialmente com:
- Mensagens recebidas enquanto o registro anterior ainda é "Novo"
- Erros do Make.com gerando registros duplicados

**Impacto:** CRM com dados duplicados, histórico fragmentado, analytics incorretos.

**Recomendação:**
No cenário Make.com, antes de criar um novo registro em Conversas:
```
1. Search Records WHERE {Telefone} = {{from}}
2. SE encontrar → UPDATE (último registro ativo)
3. SE não encontrar → CREATE (novo lead)
```
Adicionar comentário no blueprint Make.com documentando esta lógica de upsert.

---

### ⚠️ ALTOS

---

#### DB-HIGH-01: Controle de Acesso à API — Token com Permissão Total

**Problema:**
A integração Airtable no Make.com usa uma API key única com acesso a todas as tabelas e operações (leitura + escrita). Se esta key vazar (log, commit acidental, etc.), todos os dados de hóspedes ficam expostos.

**Impacto:** LGPD. Exposição de dados pessoais (nome, telefone) de hóspedes.

**Recomendação:**
Usar **Personal Access Token (PAT)** do Airtable com escopos mínimos:
```
Escopos necessários:
  - data.records:read     (leitura de registros)
  - data.records:write    (escrita/update de registros)
  - schema.bases:read     (leitura da estrutura — necessário para Make.com)

Tabelas permitidas:
  - Conversas (leitura + escrita)
  - Disponibilidade (leitura + escrita para campo Reservadas)
  - Tabela de Preços (somente leitura)
```

> Airtable PAT permite granularidade por base. Configurar em: airtable.com → Account → Personal access tokens.

---

#### DB-HIGH-02: Lógica de Preço para Períodos Mistos Indefinida

**Problema:**
A query Make.com para busca de preços usa `Sort: Preço DESC` (pega o mais alto). Para uma estadia que cruza temporadas (ex: entra na sexta em Média, sai na segunda em Alta), a lógica atual aplica **o preço mais alto para todas as noites**.

**Cenário:**
- 5 noites: 3 noites = R$300 (Média) + 2 noites = R$350 (Alta)
- Lógica atual: cobra R$350 × 5 = R$1.750
- Lógica correta: R$300×3 + R$350×2 = R$1.600

**Impacto:** Cotações com valor acima do real → atritos com hóspedes na confirmação.

**Recomendação:**
Documentar explicitamente a regra de negócio escolhida. Duas opções:
1. **Prorateio por noite** (mais justo, mais complexo no Make.com)
2. **Preço da temporada predominante** (mais simples, documentar para hóspede)
3. **Preço mais alto** (prática comum em hotelaria, mas deve ser comunicado)

Qualquer que seja, registrar em `docs/architecture/airtable-schema.md` como decisão explícita de negócio.

---

#### DB-HIGH-03: Schema Insuficiente para EPIC-PLU-04 (CRM/Retenção) e EPIC-PLU-05 (Analytics)

**Problema:**
A tabela `Conversas` mistura dados de **leads** (contatos que nunca hospedaram) com dados de **hóspedes** (que concluíram uma reserva). Para o CRM de retenção (EPIC-PLU-04) e analytics (EPIC-PLU-05), será necessário separar esses conceitos.

**Impacto:**
- EPIC-PLU-04: Impossível criar régua de retenção sem saber quem já se hospedou e quando
- EPIC-PLU-05: Impossível calcular LTV, taxa de retorno, RevPAR por período

**Recomendação (adicionar agora antes de ter volume de dados):**
Adicionar tabela `Reservas` para quando status = "Reservado":

```
Tabela: Reservas (nova — adicionar na criação do Airtable)
  - ID_Conversa (Linked Record → Conversas)
  - Telefone (Lookup)
  - Data Entrada (Date)
  - Data Saída (Date)
  - Tipo de Quarto (Single select)
  - Número de Pessoas (Number)
  - Valor Total (Currency)
  - Valor Pago (Currency)
  - Data de Pagamento (Date)
  - Origem do Lead (Single select: WhatsApp direto / Meta Ads / Google / OTA / Indicação)
  - NPS (Number 1-10) — preencher pós-hospedagem
  - Hóspede Retornou? (Checkbox) — para taxa de retorno
```

---

### 📋 MÉDIOS

---

#### DB-MED-01: Campo `canal_origem` Ausente — Inviabiliza Cálculo de CAC

**Problema:**
Nenhum campo registra de qual canal o lead chegou (Meta Ads, Google Ads, orgânico, indicação, OTA). Sem isso, é impossível calcular o CAC por canal — métrica essencial para otimizar budget de EPIC-PLU-02.

**Recomendação:**
Adicionar campo `Canal de Origem` (Single select) em Conversas:
- Valores: `WhatsApp Direto`, `Meta Ads`, `Google Ads`, `Booking.com`, `Airbnb`, `Indicação`, `Site Próprio`, `Outro`
- Preenchimento: manual pela equipe (MVP) ou via UTM parameter no futuro

---

#### DB-MED-02: Ausência de Estratégia de Backup

**Problema:**
Nenhuma estratégia documentada para backup dos dados do Airtable. Em caso de exclusão acidental de registros ou encerramento da conta, os dados de hóspedes e histórico de conversas seriam perdidos.

**Recomendação:**
Configurar automação Make.com para export semanal:
```
TRIGGER: Todo domingo às 02h
  ↓
ACTION: Airtable → List Records (Conversas completa)
  ↓
ACTION: Google Drive → Upload CSV
  FILENAME: backup_conversas_{{data}}.csv
```
Custo: 0 (usando operações Make.com já contratadas).

---

#### DB-MED-03: Dados de Alta Temporada Indefinidos — Bloqueia Cotação Automatizada

**Problema:**
A tabela `Tabela de Preços` está sem dados para Alta Temporada e Feriados (Carnaval, Natal, Réveillon, férias escolares). Quando Claude recebe pedido de cotação para esses períodos, não há preço para consultar → cotação falha ou retorna valor incorreto.

**Situação:** Aguardando pesquisa competitiva (EPIC-PLU-02) e definição pela gestão.

**Impacto imediato:** Impossível cotar 30-40% do calendário (períodos de alta demanda = maior receita).

**Recomendação:**
Criar dados provisórios com estimativa conservadora (+20% sobre temporada Média) até pesquisa ser concluída. Documentar como "Preços provisórios — revisão pendente".

---

### 🔵 BAIXOS (dívida técnica)

---

#### DB-LOW-01: Sem Validação de Formato no Campo `Telefone`

O Airtable tem campo tipo "Phone" mas não valida se o número está no formato E.164 (`5519999999999`). O Make.com recebe o número da Meta já no formato correto, mas inserções manuais podem gerar inconsistências.

**Recomendação:** Documentar no guia operacional que o número deve ser inserido no formato E.164 sem caracteres especiais.

---

#### DB-LOW-02: Campo `Temporada` em `Disponibilidade` é Redundante

O campo `Temporada` em `Disponibilidade` duplica a informação já presente em `Tabela de Preços`. Se os períodos de temporada mudarem, precisam ser atualizados em dois lugares.

**Recomendação:** Remover `Temporada` de `Disponibilidade` ou manter apenas como display informativo, nunca como dado operacional.

---

## Schema Recomendado — Diferenças do Schema Atual

### Tabela `Conversas` — Campos a Adicionar

| Campo | Tipo | Justificativa |
|-------|------|---------------|
| `Data Entrada` | Date | Automação de disponibilidade + analytics |
| `Data Saída` | Date | Idem |
| `Tipo Quarto` | Single select | Idem |
| `Número de Pessoas` | Number | Analytics de capacidade |
| `Valor Cotação` | Currency | Analytics de receita potencial |
| `Canal de Origem` | Single select | Cálculo de CAC por canal |

### Tabela `Reservas` — Criar Nova

Conforme DB-HIGH-03. Vinculada a `Conversas` via Linked Record.

### Tabela `Disponibilidade` — Automação de Decrementação

Implementar via Make.com (conforme DB-CRIT-01). Campo `Reservadas` deve ser decrementado/incrementado automaticamente.

---

## Checklist de Setup — Ordem Recomendada

Quando a base Airtable for criada (ação humana — T4 de PLU-01.2):

- [ ] 1. Criar tabela `Conversas` com **todos os campos do schema atual + campos recomendados** (adicionar agora é muito mais fácil que retroativamente)
- [ ] 2. Criar tabela `Disponibilidade` conforme schema atual
- [ ] 3. Criar tabela `Tabela de Preços` com dados provisórios para TODOS os períodos (sem lacunas)
- [ ] 4. Criar tabela `Reservas` (nova — conforme DB-HIGH-03)
- [ ] 5. Configurar Personal Access Token com escopos mínimos (DB-HIGH-01)
- [ ] 6. Popular `Disponibilidade` com próximos 90 dias de dados reais
- [ ] 7. Popular `Tabela de Preços` com todos os períodos (incluindo estimativas para alta temporada)
- [ ] 8. Documentar regra de preço para períodos mistos (DB-HIGH-02)
- [ ] 9. Configurar automação de backup semanal (DB-MED-02)
- [ ] 10. Testar inserção via Make.com com lógica de upsert por Telefone (DB-CRIT-02)

---

## Resumo dos Débitos por Prioridade

| ID | Débito | Severidade | Esforço | Quando |
|----|--------|-----------|---------|--------|
| DB-CRIT-01 | Automação de disponibilidade (overbooking) | 🔴 Crítico | 2h Make.com | PLU-01.3 |
| DB-CRIT-02 | Upsert por telefone (deduplicação) | 🔴 Crítico | 1h Make.com | PLU-01.2 |
| DB-HIGH-01 | PAT com escopos mínimos | ⚠️ Alto | 30min | Setup |
| DB-HIGH-02 | Regra de preço períodos mistos | ⚠️ Alto | 1h negócio | PLU-01.3 |
| DB-HIGH-03 | Tabela Reservas separada de Conversas | ⚠️ Alto | 1h Airtable | Setup |
| DB-MED-01 | Campo canal_origem | 📋 Médio | 15min | Setup |
| DB-MED-02 | Backup semanal automático | 📋 Médio | 1h Make.com | Pós-MVP |
| DB-MED-03 | Dados alta temporada indefinidos | 📋 Médio | 2h negócio | Urgente |
| DB-LOW-01 | Validação formato telefone | 🔵 Baixo | 30min docs | Docs |
| DB-LOW-02 | Campo Temporada redundante | 🔵 Baixo | 15min | Setup |

**Total estimado:** ~8-9 horas (sendo ~3-4h técnicas + ~3-4h de decisão de negócio)

---

## Perguntas para a Gestão da Pousada

Itens que precisam de decisão humana antes do setup do Airtable:

1. **Preços de alta temporada:** Qual a diária para Carnaval, Réveillon, Natal, férias de julho?
2. **Regra de período misto:** Como cobrar uma estadia que cruza de Baixa para Alta temporada? (ver DB-HIGH-02)
3. **Capacidade real:** Total de unidades por ala (confirmado: Ala A=8, Ala B=7, Ala C=3) — há restrições sazonais?
4. **Canal de origem:** A equipe consegue identificar de onde cada lead vem para preenchimento inicial?
5. **Mínimo de noites:** Há restrição de mínimo de noites em períodos específicos (feriados, Carnaval)?
