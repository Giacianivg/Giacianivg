# Reservations Agent

**Status:** Planejado
**Épico:** EPIC-PLU-01 (PLU-01.4 — Hardening) + EPIC-PLU-03 (Pricing Dinâmico)

## Responsabilidades Previstas

- Verificar disponibilidade em tempo real (integração motor-reserva.com.br ou calendário próprio)
- Confirmar reserva após sinal [CONFIRMAR] da Luna
- Solicitar sinal de 30% ao hóspede
- Atualizar calendário de ocupação
- Gerar voucher/confirmação formal

## Dependências

- EPIC-PLU-03: calendário de disponibilidade implementado
- `services/calendar/availability.js` (a criar)
- Integração com sistema de pagamentos (Pix automático)
