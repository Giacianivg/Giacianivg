# STATUS — Pousada Luz da Lua

> Atualizado: 2026-06-16 (sessão: melhorias calendário/reservas + diagnóstico de pricing)
> Branch: `master`

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
