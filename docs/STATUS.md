# STATUS — Pousada Luz da Lua

> Atualizado: 2026-06-12 (sessão de fechamento: grupos + deploy)
> Branch: `master` | Último commit antes desta sessão: `3ea4a3b` (frigobar → comanda)

## Fase atual

**Operação do CRM + captação de grupos.** A Fase 1.5 (Motor de Precificação Dinâmica)
está completa e commitada desde 2026-06-10 (`df50890`), com `pricing_mode='off'`
aguardando ativação pelo Founder no `pricing.html`.

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
| 1 | **Ativar o motor de pricing** (`pricing.html` → "Ativar motor") | Código em produção após o deploy de hoje; `pricing_mode='off'`. Acompanhar `price_log` nos primeiros dias. |
| 2 | **Revisar piso/teto/meta** (R$155 / R$550 / 70%) | Valores da spec; editáveis no dashboard. |
| 3 | **Alimentar `competitor_prices`** | Tabela vazia → fator concorrência neutro. Validar se o cron de scraping (03h UTC) roda após o deploy. |
| 4 | **Trocar WHATSAPP_ACCESS_TOKEN por System User Token "Nunca expira"** | Pendência antiga (erro 401 recorrente). |
| 5 | **Divulgar as páginas de grupos** | URLs públicas só fazem sentido após o smoke test de hoje passar. |

## Pendências do Claude (próxima sessão)

| # | Pendência | Contexto |
|---|-----------|----------|
| 1 | Reativar validação `X-Hub-Signature-256` no webhook (QA-01) | Débito de segurança conhecido (`webhook.js:30`) |
| 2 | Avaliar job diário que materialize o calendário em `price_log` (`source='calendar'`) | Hoje o log só grava em cotações; o dashboard calcula on-the-fly |
| 3 | Unificar inventário alas × quartos físicos | Migration 021 criou quartos físicos no CRM, mas a Luna ainda reserva por ala — risco de overbooking |

## Referências

- Pricing: `services/pricing/dynamic-pricing.js` | API `routes/pricing.js` | dashboard `public/pricing.html` | migration 019 | 40 testes em `tests/dynamic-pricing.test.js`
- Regra de segurança do pricing: `pricing_mode='off'` ⇒ `getQuoteAdjustment()` retorna `null` ⇒ cotação da Luna não muda em nada
- Grupos: `public/grupos.html` / `orcamento-grupo.html` / `fds-especiais.html` | migration 020 (RLS anon insert)
- Operação: `public/map.html` (comanda, frigobar, produtos) | migration 024 (voucher)
- Supabase produção: projeto `nqxesjxbqupmhnivkfyk`
