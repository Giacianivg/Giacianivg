# PLU-UX-02: Fluxo WhatsApp — Proposta com Numero de Referencia e PIX Automatico

**Status:** Draft
**Epic:** EPIC-PLU-07 — Luna <-> CRM e Automacoes
**Points:** 8
**Priority:** Critica — maior friction de conversao identificado
**Executor:** @dev
**Quality Gate:** @ux-design-expert + @qa

---

## User Story

**Como** hospede interessado na pousada,
**quero** receber uma proposta com numero de referencia e link de pagamento imediato,
**para** confirmar minha reserva sem precisar esperar a equipe responder.

---

## Problema (UX Friction Critica)

Fluxo atual:
```
Hospede: "Quero reservar"
Luna: [CONFIRMAR: params] -> equipe notificada
Hospede: aguarda resposta humana (pode ser horas)
         ^--- AQUI OCORRE A PERDA DE RESERVAS (especialmente a noite / fim de semana)
```

Fluxo proposto:
```
Hospede: "Quero reservar"
Luna: [CONFIRMAR: params] -> CRM cria reserva -> MercadoPago gera PIX -> Luna entrega tudo
Hospede: paga PIX em 5 minutos -> reserva confirmada automaticamente
```

---

## Acceptance Criteria

- [ ] AC-01: Proposta inclui numero de referencia (ex: PROP-2026-00087)
- [ ] AC-02: [CONFIRMAR] dispara criacao automatica de reserva no CRM (PLU-06 pre-requisito)
- [ ] AC-03: PIX gerado automaticamente via MercadoPago em < 10 segundos
- [ ] AC-04: Luna envia QR Code + chave PIX + valor exato do sinal (30%)
- [ ] AC-05: Webhook MercadoPago confirma pagamento -> status reserva = confirmada
- [ ] AC-06: Luna envia mensagem de confirmacao com numero RES-XXXX em < 30s apos pagamento
- [ ] AC-07: Fluxo funciona 24/7 sem intervencao humana

---

## Fluxo Detalhado (Before / After)

### BEFORE (estado atual)

```
Hospede: "Tem para 2 adultos de sex a dom?"
Luna: [COTAR: tipo=ALA_A, ...] → motor calcula
Luna: "Para 2 adultos, 2 noites: R$600. Sinal: R$180. Posso confirmar?"
Hospede: "Sim, quero!"
Luna: [CONFIRMAR: nome=Carlos, ...] → equipe notificada no WhatsApp
--- SILENCIO ---
Equipe: [acorda, ve mensagem, abre app banco, gera PIX, envia manualmente]
Hospede: [esperou 4h] recebe PIX
Hospede: [talvez ja tenha reservado em outro lugar]
```

### AFTER (proposto)

```
Hospede: "Tem para 2 adultos de sex a dom?"
Luna: "Um momento que vou verificar a disponibilidade..."
      [COTAR: tipo=ALA_A, data_entrada=07/03, data_saida=09/03, pessoas=2]
      [sistema verifica disponibilidade real via API]
Luna: "Temos disponibilidade!

      PROP-2026-00087
      Check-in: sab 07/mar | Check-out: dom 08/mar
      ALA A — Standard Casal (1 noite)
      Incluso: cafe da manha, piscina, estacionamento

      Total: R$300 | Sinal: R$90 (30%)
      Validade: ate 13/mar

      Quer confirmar?"

Hospede: "Sim!"
Luna: [CONFIRMAR: nome=Carlos, entrada=07/03/2026, saida=09/03/2026, tipo=ALA_A, pessoas=2, total=R$300]
      [API CRM cria reserva RES-2026-00045]
      [MercadoPago gera PIX R$90]

Luna: "Perfeito, Carlos!

      Para garantir sua reserva, pague o sinal agora:

      Valor: R$90,00
      Chave PIX: [chave]
      Ou escaneie o QR Code:
      [imagem QR]

      Valido por 48 horas. Apos o pagamento, sua reserva estara confirmada automaticamente!"

[Hospede paga PIX]
[Webhook MercadoPago -> API CRM atualiza status]

Luna: "Reserva confirmada, Carlos!

      Numero: RES-2026-00045
      Check-in: sabado 07/mar as 14h
      Check-out: domingo 08/mar ate 11h
      Sinal pago: R$90 ✔
      Restante: R$210 (pagar no check-out)

      Até lá!"
```

---

## Mensagens de Error Handling

| Cenario | Mensagem Luna |
|---------|--------------|
| Indisponivel nas datas | "Essas datas ja estao reservadas. Tenho disponibilidade em [proximas datas]. Interesse?" |
| PIX expirado | "O link de pagamento expirou. Quer que eu gere um novo?" |
| Falha na API | "Tive um probleminha tecnico. Vou chamar a equipe para te ajudar." + [ESCALAR] |
| Grupo > 8 pessoas | Automaticamente [ESCALAR] sem tentar cotar |

---

## Dependencias

- PLU-06.1: Supabase com tabelas `reservas`, `propostas`, `disponibilidade`
- PLU-06.2: API REST `/api/reservas` e `/api/disponibilidade`
- PLU-06.5: Integracao MercadoPago PIX
- PLU-07.1: Luna persistindo leads no CRM
- PLU-07.2: Luna consultando disponibilidade real

---

## Tasks de Implementacao

- [ ] T1: Atualizar webhook.js para chamar `/api/disponibilidade` antes de processar [COTAR]
- [ ] T2: Atualizar webhook.js para chamar `/api/reservas` ao detectar [CONFIRMAR]
- [ ] T3: Integrar MercadoPago PIX: gerar QR Code + chave + webhook de confirmacao
- [ ] T4: Luna recebe numero PROP-XXXX e RES-XXXX injetados no contexto
- [ ] T5: Webhook MercadoPago atualiza status reserva + dispara mensagem de confirmacao
- [ ] T6: Testes end-to-end: fluxo completo em sandbox MercadoPago

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-06 | 1.0 | Story criada apos revisao de jornada UX | Uma (@ux-design-expert) |
