# Airtable — Schema de Referência
## Pousada Luz da Lua — CRM

**Versão:** 1.1 (revisada pela auditoria Fase 2)
**Data:** 2026-02-23
**Baseado em:** `docs/architecture/airtable-schema.md` (v1.0) + recomendações DB-AUDIT.md
**Status:** Schema recomendado (ainda não criado — aguarda setup humano)

---

## Base: "Pousada Luz da Lua — CRM"

---

### Tabela 1: `Conversas`

> CRM de leads e contatos. Um registro = um número de telefone (upsert por Telefone).

| Campo | Tipo Airtable | Obrigatório | Auto | Notas |
|-------|--------------|-------------|------|-------|
| ID | Auto number | Auto | ✅ | Identificador interno |
| Nome do Hóspede | Single line text | Não | — | Coletado durante conversa |
| **Telefone** | Phone number | **Sim** | — | **Chave primária lógica.** Formato E.164: `5519999999999` |
| Data Primeiro Contato | Date | Auto | ✅ | Timestamp do primeiro contato |
| Última Mensagem | Date | Auto | ✅ | Timestamp da última interação |
| Resumo da Conversa | Long text | Não | ✅ | Gerado pelo LLM |
| Status | Single select | **Sim** | — | Ver valores abaixo |
| Escalonado? | Checkbox | Auto | ✅ | True quando [ESCALAR] acionado |
| Modelo LLM Usado | Single select | Auto | ✅ | Claude / DeepSeek / Misto |
| Follow-up Enviado? | Checkbox | Auto | ✅ | Controle do follow-up (PLU-01.3) |
| Data Cotação Enviada | Date | Auto | ✅ | Timestamp quando cotação foi enviada |
| **Data Entrada** ⭐ | Date | Condicional | — | **[NOVO]** Data check-in cotada |
| **Data Saída** ⭐ | Date | Condicional | — | **[NOVO]** Data check-out cotada |
| **Tipo Quarto** ⭐ | Single select | Condicional | — | **[NOVO]** ALA_A / ALA_B / ALA_C_CASAL |
| **Número de Pessoas** ⭐ | Number | Condicional | — | **[NOVO]** Total de hóspedes cotados |
| **Valor Cotação** ⭐ | Currency | Condicional | ✅ | **[NOVO]** Total calculado na cotação |
| **Canal de Origem** ⭐ | Single select | Não | — | **[NOVO]** Ver valores abaixo |
| Observações | Long text | Não | — | Notas manuais da equipe |

**Valores do campo `Status`:**
```
Novo               → primeiro contato, sem resposta ainda
Em atendimento     → conversa ativa com Luna
Cotação enviada    → [COTAR] processado e cotação enviada
Reserva solicitada → hóspede respondeu CONFIRMAR
Reservado          → equipe confirmou e atualizou
Encerrado          → conversa finalizada sem reserva
```

**Valores do campo `Canal de Origem` (novo):**
```
WhatsApp Direto    → contato sem campanha rastreável
Meta Ads           → veio de anúncio no Facebook/Instagram
Google Ads         → veio de anúncio no Google
Booking.com        → veio da OTA Booking
Airbnb             → veio da OTA Airbnb
Site Próprio       → veio do pousadaluzdaluasp.com.br
Indicação          → indicação de hóspede anterior
Outro
```

> ⭐ Campos marcados com ⭐ são **novos** (adicionados pela auditoria — não estão no schema v1.0).
> Campos Condicional = obrigatório somente quando `Status` = "Cotação enviada" ou posterior.

---

### Tabela 2: `Disponibilidade`

> Calendário de ocupação. Um registro = uma data × tipo de quarto.

| Campo | Tipo Airtable | Obrigatório | Auto | Notas |
|-------|--------------|-------------|------|-------|
| Data | Date | **Sim** | — | Data específica |
| Tipo de Quarto | Single select | **Sim** | — | ALA_A / ALA_B / ALA_C_GRUPO / ALA_C_CASAL |
| Total de Unidades | Number | **Sim** | — | Total de quartos desse tipo na pousada |
| Reservadas | Number | **Sim** | ✅¹ | Atualizado por automação Make.com quando reserva confirmada |
| Disponíveis | Formula | Auto | ✅ | `{Total de Unidades} - {Reservadas}` |
| Preço Base (R$) | Currency | **Sim** | — | Preço para aquela data/tipo |
| Temporada | Single select | Não | — | Baixa / Média / Alta / Feriado (informativo apenas) |
| Notas | Single line text | Não | — | Ex: "Carnaval — mínimo 3 noites" |

> ¹ Campo `Reservadas` deve ser atualizado via Make.com quando `Status` em Conversas muda para "Reservado" — não atualizar manualmente em produção.

**Valores `Tipo de Quarto`:**
```
ALA_A        → Standard Casal (8 unidades, até 3 pessoas)
ALA_B        → Família (7 unidades, até 5 pessoas)
ALA_C_GRUPO  → Grupo (2 unidades, até 8 pessoas — sempre escalar para humano)
ALA_C_CASAL  → Casal Especial (1 unidade, até 2 pessoas)
```

**Capacidade total da pousada:** 18 quartos (8 + 7 + 2 + 1)

---

### Tabela 3: `Tabela de Preços`

> Tarifas por temporada e tipo de quarto.

| Campo | Tipo Airtable | Obrigatório | Notas |
|-------|--------------|-------------|-------|
| Temporada | Single select | **Sim** | Nome da temporada |
| Tipo de Quarto | Single select | **Sim** | ALA_A / ALA_B / ALA_C_CASAL |
| Preço por Noite | Currency | **Sim** | R$ |
| Mínimo de Noites | Number | **Sim** | Ex: 1 (útil), 2 (fds), 3 (Carnaval) |
| Período Início | Date | **Sim** | Início do período |
| Período Fim | Date | **Sim** | Fim do período |
| Ativo? | Checkbox | **Sim** | Se a tarifa está vigente |

**Dados confirmados pela gestão (2026-02-24):**

### Modelo de Precificação Alta Temporada
- **Base:** R$400/noite (casal = 2 pessoas)
- **Adicional:** +R$150/noite por pessoa extra
- **Mínimo:** 2 noites em todos os períodos de alta

| Temporada | Período | 2 pess. | 3 pess. | 4 pess. | 5 pess. | Mín. Noites |
|-----------|---------|---------|---------|---------|---------|-------------|
| Baixa | Dias úteis (sem feriado) | R$300 | R$300 | R$300 | R$300 | 1 |
| Média | Fins de semana | R$300 | R$350 | R$350 | R$350 | 2 |
| Alta | Carnaval | R$400 | R$550 | R$700 | R$850 | **2** |
| Alta | Semana Santa | R$400 | R$550 | R$700 | R$850 | **2** |
| Alta | Férias de julho | R$400 | R$550 | R$700 | R$850 | **2** |
| Alta | Natal / Réveillon | R$400 | R$550 | R$700 | R$850 | **2** |
| Alta | Feriados prolongados (Tiradentes, etc.) | R$400 | R$550 | R$700 | R$850 | **2** |

> ALA_C_GRUPO: sempre sob consulta — escalar para humano independente da temporada.
> Pesquisa competitiva (EPIC-PLU-02) validará alinhamento com mercado local.

**Regra de período misto — DEFINIDA (2026-02-24):**
> **Opção C — Prorateio por noite:** cada noite é cobrada pela tarifa da temporada correspondente.
> Exemplo: 3 noites em Baixa (R$300×3) + 2 noites em Alta (R$400×2) = R$1.700 total.
> Make.com deve calcular noite a noite consultando `Tabela de Preços` para cada data.

---

### Tabela 4: `Reservas` ⭐ (Nova — Recomendada pela Auditoria)

> Histórico de reservas confirmadas. Um registro = uma reserva efetivada.
> Vinculada à tabela `Conversas` via Linked Record.

| Campo | Tipo Airtable | Obrigatório | Notas |
|-------|--------------|-------------|-------|
| ID_Conversa | Linked Record → Conversas | **Sim** | Vínculo com o lead de origem |
| Telefone | Lookup (via ID_Conversa) | Auto | |
| Nome do Hóspede | Lookup (via ID_Conversa) | Auto | |
| Data Entrada | Date | **Sim** | |
| Data Saída | Date | **Sim** | |
| Tipo de Quarto | Single select | **Sim** | |
| Número de Pessoas | Number | **Sim** | |
| Número de Noites | Formula | Auto | `DATETIME_DIFF({Data Saída}, {Data Entrada}, 'days')` |
| Valor Total | Currency | **Sim** | Valor cobrado |
| Valor Pago | Currency | Não | Para controle financeiro |
| Data de Pagamento | Date | Não | |
| Forma de Pagamento | Single select | Não | PIX / Cartão / Dinheiro |
| Canal de Origem | Lookup (via ID_Conversa) | Auto | |
| NPS | Number (1-10) | Não | Coletar pós-hospedagem |
| Hóspede Retornou? | Checkbox | Não | Para taxa de retorno |
| Observações | Long text | Não | Notas internas |

---

## Queries Make.com — Referência

### Buscar conversa ativa por telefone (lógica de upsert)

```
MODULE: Airtable — Search Records
Table: Conversas
Filter: {Telefone} = '{{from}}'
Sort: {Data Primeiro Contato} DESC
Max records: 1
```

**Se encontrar:** UPDATE o registro existente
**Se não encontrar:** CREATE novo registro

---

### Consultar disponibilidade para período

```
MODULE: Airtable — Search Records
Table: Disponibilidade
Filter: AND(
  IS_SAME({Data}, '{{data}}', 'day'),
  {Tipo de Quarto} = '{{tipo_quarto}}',
  {Disponíveis} > 0
)
```
> Executar para CADA data do período solicitado.

---

### Consultar preço para período

```
MODULE: Airtable — Search Records
Table: Tabela de Preços
Filter: AND(
  IS_BEFORE_OR_SAME({Período Início}, '{{data_entrada}}', 'day'),
  IS_AFTER_OR_SAME({Período Fim}, '{{data_saida}}', 'day'),
  {Tipo de Quarto} = '{{tipo_quarto}}',
  {Ativo?} = TRUE()
)
```
> ⚠️ Para períodos mistos: ver decisão de negócio (DB-HIGH-02). Usar Sort apropriado conforme regra.

---

### Decrementar disponibilidade quando reserva confirmada

```
MODULE: Airtable — Search Records
Table: Disponibilidade
Filter: AND(
  IS_AFTER_OR_SAME({Data}, '{{data_entrada}}', 'day'),
  IS_BEFORE({Data}, '{{data_saida}}', 'day'),
  {Tipo de Quarto} = '{{tipo_quarto}}'
)
↓
FOR EACH record found:
  MODULE: Airtable — Update Record
  {Reservadas} = {Reservadas} + 1
```

---

### Cálculo de cotação (Make.com Math)

```javascript
// Número de noites
numero_noites = DATEDIFF(data_saida, data_entrada)  // em dias

// Total bruto
total_bruto = preco_noite × numero_noites

// Descontos por estada longa
desconto_pct = numero_noites >= 14 ? 0.15 :
               numero_noites >= 7  ? 0.10 : 0

valor_desconto = total_bruto × desconto_pct
total_final = total_bruto - valor_desconto
```

---

## Estratégia de Acesso (API Security)

### Personal Access Token — Escopos Mínimos

Criar PAT em: `airtable.com → Account → Personal access tokens`

| Escopo | Permissão | Justificativa |
|--------|-----------|---------------|
| `data.records:read` | Leitura | Busca de conversas, disponibilidade, preços |
| `data.records:write` | Escrita | Criação/update de conversas e reservas |
| `schema.bases:read` | Leitura | Make.com precisa para mapear campos |

**Bases permitidas:** Somente "Pousada Luz da Lua — CRM"

> ❌ NÃO usar API key com escopo global. ❌ NÃO commitar o token em nenhum repositório.

---

## Histórico de Versões

| Data | Versão | Mudanças | Autor |
|------|--------|---------|-------|
| 2026-02-22 | 1.0 | Schema inicial (PLU-01.2 e PLU-01.3) | Dex (@dev) |
| 2026-02-23 | 1.1 | Adição de campos estruturados, tabela Reservas, PAT security, queries | Aria (@architect) — Brownfield Fase 2 |
