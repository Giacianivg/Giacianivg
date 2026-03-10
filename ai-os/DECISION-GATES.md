# Decision Gates — Portões de Decisão
## O que precisa acontecer antes de cada etapa

---

## Gate 1 — Antes de qualquer implementação (@dev)

[ ] @pm criou story com critérios de aceite?
[ ] @cto-agent aprovou se envolve arquivo crítico?
[ ] Founder confirmou? (se Nível 1 ou 2)

Se algum não: PARE. Informe o que falta.

---

## Gate 2 — Antes de qualquer deploy (@devops)

[ ] npm test → 134/134 passando?
[ ] @qa validou checklist completo?
[ ] Founder confirmou deploy? (se Nível 1)
[ ] Nenhum secret exposto no git diff?

Se algum não: PARE. Informe o que falta.

---

## Gate 3 — Antes de qualquer mudança de preço (@cfo-agent)

[ ] Margem mínima de 35% mantida?
[ ] @cfo-agent calculou e aprovou?
[ ] Founder confirmou? (Nível 2 obrigatório)

Se algum não: PARE. Informe o que falta.

---

## Gate 4 — Antes de campanha de marketing (@cmo-agent)

[ ] Copy aprovado pelo founder?
[ ] Orçamento definido e aprovado?
[ ] Landing page ou destino do anúncio pronto?
[ ] Pixel/tracking configurado?

Se algum não: PARE. Informe o que falta.

---

## Gate 5 — Antes de nova migration (@data-engineer)

[ ] Numeração sequencial (007, 008...)?
[ ] @cto-agent aprovou o schema?
[ ] Founder tem backup do Supabase?
[ ] Migration testada em ambiente local?

Se algum não: PARE. Informe o que falta.

---

## Gate 6 — Antes de decisão estratégica (@aios-master)

[ ] Dados reais disponíveis (não estimativas)?
[ ] Board completo convocado (5 C-Levels)?
[ ] Score calculado com pesos corretos?
[ ] DEC-XXX.md criado em decision-history/?
[ ] Founder aprovou o plano?

Se algum não: PARE. Informe o que falta.

---

## Referência Rápida de Gates

| Ação | Gates obrigatórios |
|------|-------------------|
| Implementar feature | Gate 1 |
| Deploy | Gate 1 + Gate 2 |
| Mudar preço | Gate 3 |
| Lançar campanha | Gate 4 |
| Nova migration | Gate 5 |
| Decisão estratégica | Gate 6 |
| Bug em arquivo crítico | Gate 1 + Gate 2 |
| Bug em arquivo seguro | Gate 2 apenas |
