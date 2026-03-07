# PLU-UX-03: Escalonamento com Contexto — Equipe recebe informacao completa

**Status:** Draft
**Epic:** EPIC-PLU-01 — Funil de Vendas (melhoria)
**Points:** 3
**Priority:** Alta
**Executor:** @dev
**Quality Gate:** @ux-design-expert

---

## User Story

**Como** membro da equipe de atendimento,
**quero** receber o contexto completo quando Luna escala um atendimento,
**para** continuar a conversa sem precisar perguntar ao hospede o que ja foi dito.

---

## Problema (UX Friction)

Mensagem atual de escalonamento para equipe:
```
[ESCALAR: cliente quer falar com humano]
---
Novo atendimento para: (19) 99840-0306
```

Problemas:
- Equipe nao sabe o nome do hospede
- Nao sabe o que foi discutido
- Nao sabe se ha cotacao pendente
- Tem que perguntar tudo de novo para o hospede (experiencia ruim)

---

## Acceptance Criteria

- [ ] AC-01: Mensagem de escalonamento inclui: nome do hospede, motivo, ultimas 3 mensagens
- [ ] AC-02: Se havia cotacao em andamento, incluir dados (datas, tipo, valor)
- [ ] AC-03: Instrucao clara para a equipe sobre o modo relay
- [ ] AC-04: Link direto para conversa no WhatsApp do hospede
- [ ] AC-05: Tempo de resposta da equipe esperado visivel (SLA)

---

## Template de Mensagem Proposto

```
🏨 ATENDIMENTO ESCALADO — LUNA

👤 Hospede: Carlos Souza
📱 WhatsApp: +55 19 99999-9999
⏰ Hora: 23:14

📋 Motivo: cliente quer negociar desconto para grupo grande

💬 Ultimas mensagens:
  Carlos: "Somos 12 pessoas, pode fazer preco especial?"
  Luna: "Para grupos acima de 8 precisamos verificar com a equipe."
  Carlos: "Tudo bem, quanto ficaria?"

📅 Cotacao em andamento:
  Datas: 15/mai a 18/mai (3 noites)
  Tipo: ALA_C_GRUPO (12 pessoas)
  Valor estimado: a definir pela equipe

---
Responda aqui que Luna reformula e entrega ao hospede.
SLA esperado: ate 30 minutos (horario comercial) | ate manha seguinte (fora do horario)
```

---

## Mudancas no System Prompt (Luna)

Atualizar secao [ESCALAR] de:
```
Formato: [ESCALAR: cliente quer X]
```

Para:
```
Formato: [ESCALAR: motivo=X, nome=NOME_CLIENTE, interesse=RESUMO_DO_QUE_QUER]

Exemplo:
[ESCALAR: motivo=negociacao de desconto para grupo, nome=Carlos, interesse=12 pessoas 15 a 18 mai precificacao especial]
```

---

## Mudancas no webhook.js

Ao detectar [ESCALAR], montar mensagem para equipe com:
1. Dados extraidos do sinal (`motivo`, `nome`, `interesse`)
2. Ultimas 3 mensagens do historico (Google Sheets / Supabase)
3. Cotacao em andamento se houver (last [COTAR] emitido na sessao)
4. Link `https://wa.me/55NUMERO` para iniciar conversa com hospede
5. Instrucao de relay

---

## Tasks

- [ ] T1: Atualizar system prompt — novo formato [ESCALAR] com campos estruturados
- [ ] T2: Atualizar webhook.js — parser do novo formato [ESCALAR]
- [ ] T3: Atualizar webhook.js — buscar ultimas 3 msgs do historico ao escalar
- [ ] T4: Formatar mensagem completa para equipe conforme template acima
- [ ] T5: Teste: escalonamento durante cotacao em andamento

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Story criada apos revisao de jornada UX | Uma (@ux-design-expert) |
