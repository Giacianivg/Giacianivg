# STATUS — Pousada Luz da Lua

> Atualizado: 2026-06-24 (sessão: Bloco 1 — Higiene de dados / marcador is_test)
> Branch: `master`

## Bloco 1 — Higiene de dados (is_test) — 2026-06-24

Roadmap incremental (30 dias, blocos isolados). **Bloco 1 concluído** (local + DB de
produção). Falta **deploy** (`npx vercel --prod`) para os filtros valerem na dashboard ao vivo.

- **Migrations 039 + 040** (aplicadas em produção): coluna `is_test` em 8 tabelas
  (leads, reservations, proposals, conversation_states, conversations, payments,
  room_charges, counter_tabs); tabela `test_phone_numbers`; triggers de auto-marca
  (telefone na lista) e herança ("teste pegajoso pra baixo"); função
  `set_test_by_phone()`; views `vw_today_board`/`vw_room_day_status` excluem teste.
- **Backfill:** tudo `is_test=true`, **exceto** a única reserva real `RES-2026-00019`
  (grupo 60px, 13–18/07/2026, R$39.000). Lead "jaine" fica como teste (telefone fake),
  mas a reserva é real e aparece nos KPIs — **exceção fixada** (não use o botão "marcar
  teste" em jaine, cascatearia na reserva real).
- **Backend:** filtro `is_test=false` em funnel/revenue analytics, financial, alerts,
  ai-activity; alert-calculator ignora lead de teste.
- **CRM:** listas (leads.html, bookings.html) escondem teste por padrão + toggle
  "Mostrar testes"; botão 🧪 marca/desmarca lead como teste (`/api/leads/:id/mark-test`).
- **Testes:** 491/491 verdes (2 novos provam exclusão); lint 0 erros.
- Número da equipe `5519998400306` semeado em `test_phone_numbers`.

## ⚠️ AVISO CRÍTICO — Motor de pricing está LIGADO (`auto`)

**Antes de reativar a Luna (hoje inativa por questão do Facebook), REVISAR os
parâmetros do motor e validar os preços que ele vai cotar. NÃO reativar a Luna
sem essa revisão.**

Diagnóstico em produção (`nqxesjxbqupmhnivkfyk`, 2026-06-16):
- `pricing_mode = 'auto'` (a documentação antiga dizia `off` — estava errada).
- `price_floor = 220` · `price_ceiling = 550` · `target_occupancy = 70`.
- `buildCalendar()` roda sem erro (motor funcional, **não** inerte).
- `price_log` **vazio** + `0 overrides` → **nenhuma cotação real saiu com preço do
  motor** (Luna inativa nunca o invocou).
- **Simulação:** com ocupação ~0% nas datas futuras, o motor cotaria quase tudo no
  **piso R$220** (ALA_A R$300 → R$220; ALA_B R$350 → R$245). Religar a Luna assim
  faria ela cotar muito barato. Revisar floor/teto/multiplicadores antes.

### 🔗 Pendência amarrada a religar a Luna — Bloco 4 / C′ (overrides de preço absoluto)

O Bloco 4 cria a tabela `room_price_overrides` (preço absoluto em R$ por ala/data,
migration 031) e o **calendário já exibe e trava** esses preços. **A Luna AINDA NÃO
honra esses overrides** — isso foi deixado de fora de propósito porque exige editar
`services/quotation/engine.js` (caminho da cotação).

**Antes de religar a Luna, fazer (com OK explícito do Founder):**
1. Editar `engine.js` para honrar `room_price_overrides` (gated em `pricing_mode='auto'`).
2. **Teste obrigatório** provando que a cotação **sem** override fica **byte-idêntica** à atual.
3. Validar junto com a revisão de floor/teto/multiplicadores acima.

Enquanto isso não for feito: os overrides são apenas a visão operacional do dono no
calendário; não afetam nenhuma cotação (e a Luna está inativa de qualquer forma).

### 🔗 Pendência amarrada a religar a Luna — DEC-023 / F6 (teto de venda por ala)

A DEC-023 cria o **teto de venda por ala/data** (`ala_inventory_caps`, migration 033;
view `vw_ala_sellable`). O **calendário já permite definir o teto** (arraste na linha da
ala em "Disponibilidade — quartos à venda") e o **CRM já respeita** o teto na criação de
reserva por quarto físico (`create_reservation_atomic`, migration 034). **A Luna AINDA NÃO
honra o teto** — o caminho legado por ala (`room_type IN ('ALA_A','ALA_B','ALA_C_CASAL')`)
foi deixado de fora de propósito porque exige tocar arquivos protegidos
(`services/whatsapp/webhook.js` e/ou `services/luna/system-prompt.js`).

**Antes de religar a Luna, fazer (com OK explícito do Founder + aprovação CTO):**
1. Incorporar o teto ao caminho legado por ala da cotação/confirmação da Luna.
2. Reconciliar a contagem de `vw_ala_sellable` para incluir reservas do caminho legado
   por ala (hoje conta só quartos físicos `A1–C5`, correto enquanto a Luna está inativa).
3. **Teste obrigatório** provando que a cotação/confirmação atual segue inalterada quando
   não há teto definido.

Enquanto isso não for feito: o teto é respeitado pelo CRM (reservas por quarto físico),
mas a Luna (inativa) não o aplicaria no caminho por ala.

## Fase atual

**Operação do CRM + captação de grupos.** A Fase 1.5 (Motor de Precificação Dinâmica)
está completa e commitada desde 2026-06-10 (`df50890`). **Status real:
`pricing_mode='auto'`** (ver aviso crítico acima) — só não cobra ninguém porque a
Luna está inativa.

## Trabalho recente (sessões de 11–12/06)

**Mapa de quartos / operação diária** (commits `bb2f962` … `3ea4a3b`):
- Comanda por quarto no mapa, estoque real e relatório de consumo do dia
- Frigobar físico por quarto; botão "Consumido" lança item na comanda
- Voucher gerado automaticamente na criação da reserva (migration 024)
- Gestão de produtos migrada do `rooms.html` para o `map.html`
- Menu lateral padronizado em todas as páginas
- Fixes de timezone: "hoje" em UTC jogava check-ins para o dia seguinte;
  relatório do dia usava janela UTC e perdia consumo noturno
- Fix: quartos ocupados não apareciam no mapa no dia do checkout

**Páginas públicas de captação de grupos** (fechadas nesta sessão de 12/06):
- `public/grupos.html`, `public/fds-especiais.html`, `public/orcamento-grupo.html`
- Rotas amigáveis `/grupos`, `/fds-especiais`, `/orcamento-grupo` no `vercel.json`
- Migration 020: policy RLS de INSERT para `anon` em `leads`, restrita a
  `lead_source = 'site-grupos'` (formulário grava lead direto do browser)

## Em andamento (sessão 12/06)

Deploy aprovado pelo Founder em 12/06: commit (migration 020 + vercel.json + STATUS),
aplicação da migration 020 em produção, `npx vercel --prod`, smoke test das URLs
públicas e push para o GitHub via @devops.

## PENDENTES-VITOR (decisões/ações suas)

| # | Pendência | Contexto |
|---|-----------|----------|
| 1 | **Revisar o motor de pricing ANTES de religar a Luna** | `pricing_mode` JÁ está `auto` (ver aviso crítico no topo). Com ocupação ~0%, cotaria no piso R$220. Revisar floor/teto/multiplicadores e validar preços antes de reativar a Luna. |
| 2 | **Revisar piso/teto/meta** (R$155 / R$550 / 70%) | Valores da spec; editáveis no dashboard. |
| 3 | **Alimentar `competitor_prices`** | Tabela vazia → fator concorrência neutro. Validar se o cron de scraping (03h UTC) roda após o deploy. |
| 4 | **Trocar WHATSAPP_ACCESS_TOKEN por System User Token "Nunca expira"** | Pendência antiga (erro 401 recorrente). |
| 5 | **Divulgar as páginas de grupos** | URLs públicas só fazem sentido após o smoke test de hoje passar. |

## Pendências do Claude (próxima sessão)

| # | Pendência | Contexto |
|---|-----------|----------|
| 1 | ~~Reativar validação `X-Hub-Signature-256` (QA-01)~~ | **Resolvido** — já estava ativa em produção (verificado 2026-06-12: POST sem assinatura → 403); docs corrigidas na DEC-021 |
| 2 | Avaliar job diário que materialize o calendário em `price_log` (`source='calendar'`) | Hoje o log só grava em cotações; o dashboard calcula on-the-fly |
| 3 | Unificar inventário alas × quartos físicos | Migration 021 criou quartos físicos no CRM, mas a Luna ainda reserva por ala — risco de overbooking |

## Referências

- Pricing: `services/pricing/dynamic-pricing.js` | API `routes/pricing.js` | dashboard `public/pricing.html` | migration 019 | 40 testes em `tests/dynamic-pricing.test.js`
- Regra de segurança do pricing: `pricing_mode='off'` ⇒ `getQuoteAdjustment()` retorna `null` ⇒ cotação da Luna não muda em nada
- Grupos: `public/grupos.html` / `orcamento-grupo.html` / `fds-especiais.html` | migration 020 (RLS anon insert)
- Operação: `public/map.html` (comanda, frigobar, produtos) | migration 024 (voucher)
- Supabase produção: projeto `nqxesjxbqupmhnivkfyk`
