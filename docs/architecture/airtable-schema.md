# Airtable — Schema "Pousada Luz da Lua — CRM"

**Story:** PLU-01.2 + PLU-01.3 | **Atualizado:** 2026-02-22

---

## Base: "Pousada Luz da Lua — CRM"

### Tabela 1: Conversas

| Campo | Tipo Airtable | Obrigatório | Descrição |
|-------|--------------|-------------|-----------|
| ID | Auto number | Auto | Identificador único sequencial |
| Nome do Hóspede | Single line text | Não | Nome coletado durante conversa |
| Telefone | Phone number | Sim | Número WhatsApp E.164 (ex: 5519999999999) |
| Data Primeiro Contato | Date | Auto | Data/hora do primeiro contato |
| Última Mensagem | Date | Auto | Data/hora da última interação |
| Resumo da Conversa | Long text | Não | Resumo gerado pelo LLM |
| Status | Single select | Sim | Novo / Em atendimento / Cotação enviada / Reserva solicitada / Reservado / Encerrado |
| Escalonado? | Checkbox | Auto | True se [ESCALAR] foi acionado |
| Modelo LLM Usado | Single select | Auto | Claude / DeepSeek / Misto |
| Follow-up Enviado? | Checkbox | Auto | Controle do follow-up automático (PLU-01.3) |
| Data Cotação Enviada | Date | Auto | Timestamp quando cotação foi enviada |
| Observações | Long text | Não | Notas manuais da equipe |

**Valores do campo Status:**
- `Novo` — primeiro contato, sem resposta ainda
- `Em atendimento` — conversa ativa com Luna
- `Cotação enviada` — [COTAR] foi processado e cotação enviada
- `Reserva solicitada` — hóspede respondeu CONFIRMAR
- `Reservado` — equipe confirmou e atualizou manualmente
- `Encerrado` — conversa finalizada sem reserva

---

### Tabela 2: Disponibilidade

| Campo | Tipo Airtable | Obrigatório | Descrição |
|-------|--------------|-------------|-----------|
| Data | Date | Sim | Data específica |
| Tipo de Quarto | Single select | Sim | ALA_A / ALA_B / ALA_C_GRUPO / ALA_C_CASAL |
| Total de Unidades | Number | Sim | Total de quartos daquele tipo |
| Reservadas | Number | Sim | Quartos já reservados (atualizar manualmente) |
| Disponíveis | Formula | Auto | `{Total de Unidades} - {Reservadas}` |
| Preço Base (R$) | Currency | Sim | Preço base para aquela data/tipo |
| Temporada | Single select | Não | Baixa / Média / Alta / Feriado |
| Notas | Single line text | Não | Observações (ex: "Carnaval - mínimo 3 noites") |

**Tipos de Quarto:**
- `ALA_A` — Standard Casal (até 3 pessoas, R$300)
- `ALA_B` — Família (até 5 pessoas, R$300-350)
- `ALA_C_GRUPO` — Grupo (até 8 pessoas, sob consulta)
- `ALA_C_CASAL` — Casal especial (até 2 pessoas, R$300)

**Preços confirmados pela gestão (2026-02-24):**

### Modelo de Precificação

**Lógica:** R$400/noite (base casal = 2 pessoas) + R$150/noite por pessoa adicional

| Temporada | Período | 2 pessoas | 3 pessoas | 4 pessoas | 5 pessoas | Mín. noites |
|-----------|---------|-----------|-----------|-----------|-----------|-------------|
| Baixa | Dias úteis fora de feriados | R$300 | R$300 | R$300* | R$300* | 1 |
| Média | Fins de semana | R$300-350 | R$300-350 | R$350* | R$350* | 2 |
| Alta | Carnaval, Semana Santa, Férias jul, Natal, Réveillon, Feriados prolongados | R$400 | R$550 | R$700 | R$850 | **2** |

> *Temporadas Baixa e Média: modelo de preço fixo por quarto (não por pessoa). Confirmar com gestão se aplica adicional por pessoa fora da alta.
> Alta temporada: **R$400 base (casal) + R$150/pessoa adicional** — confirmado pela gestão.
> ALA_C_GRUPO: sempre sob consulta, escalar para atendimento humano.

**Regra de período misto:** Prorateio por noite (opção C) — cada noite paga pela temporada correspondente.

**Mínimo de noites:**
- Geral: 1 noite
- Fins de semana: 2 noites
- Alta temporada (todos os feriados de alta procura): **2 noites**

> Pesquisa competitiva (EPIC-PLU-02) validará se esses preços estão alinhados com o mercado.

---

### Tabela 3: Tabela de Preços

| Campo | Tipo Airtable | Descrição |
|-------|--------------|-----------|
| Temporada | Single select | Nome da temporada |
| Tipo de Quarto | Single select | ALA_A / ALA_B / ALA_C_CASAL |
| Preço por Noite | Currency | R$ |
| Mínimo de Noites | Number | Mínimo de noites nessa temporada (ex: 2 no fds, 3 no Carnaval) |
| Período Início | Date | Início do período desta temporada |
| Período Fim | Date | Fim do período desta temporada |
| Ativo? | Checkbox | Se esta tarifa está vigente |

---

## Como Make.com Consulta Disponibilidade

### GET disponibilidade para um período

```
Módulo: Airtable — Search Records
Table: Disponibilidade
Filter: AND(
  IS_SAME({Data}, '{{data_entrada}}', 'day'),
  {Tipo de Quarto} = '{{tipo_quarto}}',
  {Disponíveis} > 0
)
```

### GET preço para um período

```
Módulo: Airtable — Search Records
Table: Tabela de Preços
Filter: AND(
  IS_BEFORE({Período Início}, '{{data_entrada}}'),
  IS_AFTER({Período Fim}, '{{data_saida}}'),
  {Tipo de Quarto} = '{{tipo_quarto}}',
  {Ativo?} = TRUE()
)
Sort: {Preço por Noite} DESC (pegar o mais alto para períodos múltiplos)
```

### Cálculo no Make.com

```javascript
// Número de noites
numero_noites = DATEDIF(data_entrada, data_saida, "D")

// Total sem desconto
total_bruto = preco_noite * numero_noites

// Desconto por estada longa (sugestão):
// 7+ noites → 10% de desconto
// 14+ noites → 15% de desconto
desconto = numero_noites >= 14 ? 0.15 : (numero_noites >= 7 ? 0.10 : 0)
total_final = total_bruto * (1 - desconto)
```

---

## Follow-up Automático (PLU-01.3 — T4)

**Trigger no Make.com (cenário separado "Follow-up pós-cotação"):**

```
TRIGGER: Airtable — Watch Records
  Filter: {Status} = 'Cotação enviada' AND {Follow-up Enviado?} = FALSE()
  ↓
FILTER: Última mensagem foi há mais de 2 horas?
  (Data atual - {Data Cotação Enviada} > 120 minutos)
  ↓
MODULE: Enviar mensagem WhatsApp ao hóspede:
  "Olá {{Nome do Hóspede}}! 🌙 Vi que você recebeu nossa cotação há pouco.
  Ainda tem interesse? Posso tirar alguma dúvida ou ajustar o período?
  Estamos aqui para te ajudar! ☀️"
  ↓
MODULE: Airtable — Update Record
  {Follow-up Enviado?} = TRUE()
```

---

## Notificação de Confirmação (PLU-01.3 — T5)

Quando hóspede responde "CONFIRMAR":

```
MODULE: Claude gera mensagem de confirmação:
  "Ótimo! Sua reserva foi solicitada com sucesso 🌙
  Nosso time irá confirmar em breve e te enviar as instruções para finalizar.
  Estamos ansiosos para receber você na Pousada Luz da Lua! ☀️"
  ↓
MODULE: Airtable — Update Record
  {Status} = 'Reserva solicitada'
  ↓
MODULE: WhatsApp API — Enviar mensagem para EQUIPE_WHATSAPP_NUMBER:
  "🔔 *Nova reserva solicitada!*
  Hóspede: {{Nome}} | Tel: {{Telefone}}
  Período: {{data_entrada}} a {{data_saida}}
  Quarto: {{tipo_quarto}} | Pessoas: {{numero_pessoas}}
  Total: R$ {{total_final}}
  👉 Airtable: [link direto para o registro]"
```
