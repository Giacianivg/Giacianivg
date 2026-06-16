# EPIC DEC-022 — Inventário Unificado em Quartos Físicos

> **Status:** 🟡 Backlog — RUMO APROVADO, EXECUÇÃO ADIADA (Founder, 2026-06-16).
> Nenhuma story deve sair de `Draft` sem nova aprovação N1/N2.
> Referência de decisão: `ai-os/data/decision-history/DEC-022.md` (origem: DEC-021 P5).

## Objetivo

Tornar o quarto físico (`A1`–`C5`) a fonte única de disponibilidade, eliminando o
inventário duplo (ala × quarto) que causa risco de overbooking Luna×CRM e impede
fechar/abrir quarto individual. Discurso da Luna por ala é preservado via view de agregação.

## Princípios

- **Fases aditivas:** nada de migration destrutiva sobre `001–021`; sempre nova numerada.
- **Cotação inalterada:** comportamento da Luna byte-idêntico até a fonte mudar (padrão migration 018).
- **Rede de proteção:** 445 testes verdes antes e depois de cada fase.
- **Portões CTO:** F2 e F3 tocam `webhook.js`/`system-prompt.js` → exigem aprovação CTO.

## Stories

### DEC022-01 — Migration aditiva: disponibilidade por quarto físico + view de ala
- **Fase:** F1 · **Status:** Draft · **Risco:** Médio · **Bloqueante de:** todas as demais
- **Escopo IN:** nova migration (≥ 031) com disponibilidade por `room_id` físico;
  view `vw_ala_availability` agregando quarto→ala; RLS nas tabelas/views novas; seed/backfill
  a partir de `availability` atual.
- **Escopo OUT:** qualquer leitura por backend/Luna (fica na F2).
- **AC:** (1) view retorna, por ala/data, disponibilidade idêntica à `availability` atual;
  (2) 445 testes verdes; (3) nenhuma migration `001–021` alterada.

### DEC022-02 — Backend lê disponibilidade da view (cotação byte-idêntica)
- **Fase:** F2 · **Status:** Draft · **Risco:** Alto · **Depende de:** DEC022-01 · **Portão:** CTO
- **Escopo IN:** cotação/disponibilidade passam a ler `vw_ala_availability`.
- **AC:** (1) cotação idêntica em todos os cenários de teste existentes; (2) 445 verdes;
  (3) aprovação CTO registrada (toca caminho da Luna).

### DEC022-03 — `[CONFIRMAR]` aloca quarto físico
- **Fase:** F3 · **Status:** Draft · **Risco:** Alto · **Depende de:** DEC022-02 · **Portão:** CTO
- **Escopo IN:** alocação de quarto físico na confirmação (`webhook.js`); regra de escolha do quarto.
- **Escopo OUT:** mudança no discurso da Luna ao hóspede (continua por ala).
- **AC:** (1) confirmação grava `room_id` físico sem overbooking; (2) 445 verdes;
  (3) aprovação CTO registrada (toca `webhook.js` + `system-prompt.js`).

### DEC022-04 — Frontend por quarto + fechar/abrir quarto individual
- **Fase:** F4 · **Status:** Draft · **Risco:** Médio · **Depende de:** DEC022-03
- **Escopo IN:** calendário/bookings renderizam por quarto físico; botões Fechar/Abrir
  por quarto (bloqueio por `room_id`).
- **AC:** (1) é possível fechar/abrir um quarto individual (ex.: A3); (2) datas reservadas
  não podem ser fechadas; (3) 445 verdes.

## Dependências externas
- Aprovação N1 do Founder para iniciar F1.
- Aprovações CTO para F2 e F3.
