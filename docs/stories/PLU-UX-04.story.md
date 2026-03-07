# PLU-UX-04: Pre-Estadia — Mensagens de Check-in com Instrucoes de Acesso

**Status:** Draft
**Epic:** EPIC-PLU-07 — Luna <-> CRM e Automacoes
**Points:** 3
**Priority:** Media
**Executor:** @dev
**Quality Gate:** @ux-design-expert

---

## User Story

**Como** hospede com reserva confirmada,
**quero** receber instrucoes claras de acesso e chegada no dia anterior ao check-in,
**para** chegar sem ansiedade e sem precisar ligar para a pousada.

---

## Problema (UX Friction)

Hospede de primeira visita nao sabe:
- Como chegar (GPS leva para lugar errado as vezes)
- Qual e o horario exato de check-in
- O que trazer / o que nao trazer
- Com quem falar na chegada
- Senha do Wi-Fi (economiza pergunta na recepcao)

Resultado: ligacoes e mensagens desnecessarias para equipe no dia do check-in.

---

## Acceptance Criteria

- [ ] AC-01: Mensagem D-1 enviada automaticamente as 10h para todas as reservas do dia seguinte
- [ ] AC-02: Mensagem inclui: link Google Maps correto, horario check-in, numero do gerente
- [ ] AC-03: Mensagem D-0 (dia do check-in) as 14h: "esperamos voce!"
- [ ] AC-04: Mensagem D+1 apos check-out: agradecimento + link avaliacao Google Maps
- [ ] AC-05: Mensagem personalizada com nome do hospede e numero da reserva

---

## Templates de Mensagem

### D-1 (dia anterior, 10h)

```
Ola, {nome}! Amanha e o grande dia 🌙

Sua reserva: RES-2026-00087
Check-in: amanha, {data}, a partir das 14h
Check-out: {data_saida} ate 11h

Como chegar:
📍 Rua Exemplo, 123 - Lindoia-SP
🗺 Google Maps: [link correto]

Na chegada: toque a campainha da portaria (24h)
Porteiro: Joao — (19) 99840-0306

Wi-Fi: PousadaLuaLivre | Senha: lua2026

Tem alguma duvida? So chamar aqui!
```

### D-0 manhã (dia do check-in, 10h)

```
Bom dia, {nome}! Hoje e o dia 🎉

Check-in a partir das 14h.
Se precisar chegar antes, avise que verificamos disponibilidade!

Te esperamos em breve 🌙
```

### D+1 (pos check-out, 10h)

```
Oi {nome}! Esperamos que a estadia tenha sido incrivel.

Sua opiniao e muito importante para nos:
⭐ Avalie no Google Maps: [link]

Ate a proxima vez! Clientes que retornam ganham desconto especial 😉
```

---

## Configuracao n8n (Workflow)

```yaml
workflow: pre-estadia-lembretes
triggers:
  - cron: "0 10 * * *"  # diario as 10h
  - cron: "0 14 * * *"  # diario as 14h (D-0)

jobs:
  D-1:
    query: "SELECT * FROM reservas WHERE data_checkin = TOMORROW AND status = 'confirmada'"
    template: d_minus_1

  D-0-manha:
    query: "SELECT * FROM reservas WHERE data_checkin = TODAY AND status = 'confirmada'"
    template: d_zero_manha

  D+1:
    query: "SELECT * FROM reservas WHERE data_checkout = YESTERDAY AND status = 'concluida'"
    template: d_mais_1
```

---

## Dados Necessarios no CRM (PLU-06)

A tabela `reservas` deve ter:
- `lead_id` -> join com `leads.numero_whatsapp` e `leads.nome`
- `data_checkin`, `data_checkout`
- `status_reserva` (confirmada / concluida)
- `numero_reserva` (RES-XXXX)

---

## Tasks

- [ ] T1: Criar workflow n8n `pre-estadia-lembretes` com 3 jobs (D-1, D-0, D+1)
- [ ] T2: Templates WhatsApp aprovados pela Meta (necessario para mensagens outbound)
- [ ] T3: Parametros do template: nome, numero_reserva, data_checkin, data_checkout
- [ ] T4: Link Google Maps correto validado pela equipe
- [ ] T5: Teste com reserva real (sandbox → producao)

---

## Nota: Templates Meta

Mensagens outbound (pousada iniciando contato) exigem template aprovado pela Meta.
Prazo de aprovacao: ate 24h.
Formatos aceitos: texto com variaveis {{1}}, {{2}}, etc.

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Story criada apos revisao de jornada UX | Uma (@ux-design-expert) |
