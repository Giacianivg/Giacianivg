# EPIC-PLU-12 — Vouchers PDF de Hospedagem

**Projeto:** Pousada Luz da Lua | Socorro-SP
**DEC:** DEC-016
**Prioridade:** Alta
**Pontos estimados:** 13
**Impacto:** Profissionalismo + Luna entrega comprovante
**Status:** InProgress
**Criado:** 2026-03-12

---

## Objetivo

Permitir que a Pousada Luz da Lua emita vouchers PDF com identidade visual própria para
reservas de qualquer fonte (direto, Booking, Expedia, WhatsApp). Luna pode enviar o link
do voucher quando o hóspede solicitar. O gestor tem página no CRM para buscar e gerenciar
todos os vouchers.

---

## Valor de Negócio

| Problema Atual | Solução |
|----------------|---------|
| Sem comprovante formal de reserva | PDF com identidade visual profissional |
| Luna não consegue entregar comprovante | Luna fornece link direto de download |
| Booking/Expedia sem rastreamento | Vouchers de todas as fontes no CRM |
| Processo manual e sem padrão | Geração automatizada via API |

---

## Stories

| Story | Título | Status | Pontos |
|-------|--------|--------|--------|
| PLU-12.1 | Vouchers PDF: Geração + API + Página CRM + Luna | InProgress | 13 |

---

## Arquitetura

```
pdf-lib (pure JS)
    ↓
services/voucher/voucher-generator.js
    ↓
routes/vouchers.js  →  GET /api/vouchers/:id/download  (PDF stream)
                    →  GET /api/vouchers               (lista)
                    →  POST /api/vouchers              (criar)
                    →  PATCH /api/vouchers/:id         (atualizar)
    ↓
server.js  app.use('/api/vouchers', ...)
    ↓
public/vouchers.html  (busca + filtro + preview)
    ↓
Luna system-prompt  (instrução para fornecer link)
```

---

## Critérios de Conclusão do Épico

- [ ] PDF gerado com layout e cores da Pousada Luz da Lua
- [ ] Fontes suportadas: direct, booking, expedia, whatsapp
- [ ] API REST completa com endpoint de download (sem auth via token)
- [ ] Página CRM com busca por nome/data e filtro por fonte/status
- [ ] Luna orientada a fornecer link quando hóspede pedir
- [ ] Migration 010 aplicada em produção
- [ ] 139+/139+ testes passando
- [ ] Deploy em produção via @devops
