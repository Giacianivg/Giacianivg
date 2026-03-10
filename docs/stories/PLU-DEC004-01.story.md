# PLU-DEC004-01 — Pacote Escapada Romantica Pascoa — Luna + Engine

**Epic:** EPIC-PLU-01 Funil de Vendas Automatizado (WhatsApp + Claude)
**DEC:** DEC-004 — PACOTE_PASCOA (Aprovado 2026-03-10)
**Status:** Ready
**Points:** 3
**Priority:** Critica
**Prazo:** Implementar ate 2026-03-12
**Created:** 2026-03-10
**Author:** Orion (@aios-master) via CTO Agent

---

## Description

DEC-004 aprovou alteracoes minimas em `engine.js` e `system-prompt.js` para ativar o
Pacote Escapada Romantica de Pascoa (28/mar–06/abr/2026).

A campanha Meta Ads (PLU-02.1) estara ativa enviando leads ao bot Luna.
Sem script especifico, Luna cota normalmente mas nao apresenta o pacote diferenciado.
Com o script, Luna identifica interesse em Pascoa e fecha com proposta direta.

**Restricoes CTO (inegociaveis):**
- Nao alterar logica de [COTAR:], [CONFIRMAR:] ou [ESCALAR:]
- Nao alterar calculo de temporada base
- Nao remover nem modificar nada — apenas adicionar
- 139/139 testes devem passar apos implementacao

---

## Acceptance Criteria

### AC-1: engine.js — Preco Pacote Pascoa
**Given** um lead pergunta sobre hospedagem no periodo 28/mar–06/abr/2026
**When** Luna emite o sinal [COTAR: tipo=ALA_A ou ALA_B, data_entrada=DD/MM/YYYY, data_saida=DD/MM/YYYY, pessoas=2]
**Then** o engine retorna o preco do pacote Pascoa: R$ 900 fixo (2 noites, 2 pessoas, cafe incluso)
**And** o preco normal (calcular por noite) continua funcionando para datas fora do periodo
**And** para mais de 2 pessoas ou mais de 2 noites, usa calculo normal de alta temporada

### AC-2: engine.js — Flag de Expiracao
**Given** a data atual e posterior a 06/abr/2026
**When** o engine e chamado com datas de Pascoa
**Then** o bloco PASCOA_PACKAGE e ignorado e o calculo normal e aplicado
**And** nao e necessario remover o codigo — a flag de data faz o controle

### AC-3: system-prompt.js — Identificacao de Interesse Pascoa
**Given** um lead menciona Pascoa, abril, feriado, semana santa ou "semana da Pascoa"
**When** Luna processa a mensagem
**Then** Luna apresenta proativamente o pacote Escapada Romantica
**And** usa linguagem acolhedora com urgencia suave ("vagas limitadas")
**And** pergunta quantas pessoas e as datas pretendidas para cotar

### AC-4: system-prompt.js — Script de Apresentacao
**Given** Luna identificou interesse em Pascoa
**When** apresenta o pacote
**Then** usa este script (adaptar ao tom da conversa):

```
Que otimo que voce quer passar a Pascoa aqui!
Temos um pacote especial: Escapada Romantica de Pascoa.

2 noites + cafe da manha incluso por R$ 900 (para 2 pessoas).
Periodo: 28 de marco a 6 de abril.

As vagas estao se esgotando rapidinho!
Me conta: quantas pessoas viriam e quais datas você prefere?
```

**And** apos receber datas, emite [COTAR:] normalmente para confirmar disponibilidade

### AC-5: Compatibilidade com Fluxo Existente
**Given** qualquer outra conversa nao relacionada a Pascoa
**When** Luna processa a mensagem
**Then** o comportamento e identico ao atual — sem alteracoes no fluxo normal
**And** todos os sinais de controle ([COTAR:], [CONFIRMAR:], [ESCALAR:], [NOME:]) funcionam normalmente

### AC-6: Testes
**Given** a implementacao esta completa
**When** o dev roda `npm test`
**Then** 139/139 testes passam (zero regressoes)
**And** adicionar ao menos 2 novos testes:
  - `engine.js: retorna R$900 para 2n/2px no periodo Pascoa`
  - `engine.js: retorna preco normal para datas fora do periodo Pascoa`

---

## Scope

### IN
- `services/quotation/engine.js`: bloco `PASCOA_PACKAGE` com flag de data e preco R$900
- `services/luna/system-prompt.js`: adicionar secao "Pacote Pascoa 2026" ao prompt
- Novos testes unitarios para o bloco Pascoa no engine

### OUT
- Nao alterar logica de temporada (alta/media/baixa)
- Nao alterar feriado_ranges existentes
- Nao alterar sinais de controle ([COTAR:], [CONFIRMAR:], [ESCALAR:], [NOME:])
- Nao criar novos endpoints ou rotas
- Nao alterar nenhum outro arquivo alem dos 2 especificados

---

## Technical Notes

### Implementacao engine.js

Adicionar bloco isolado ANTES do return do calculo atual:

```javascript
// PASCOA_PACKAGE 2026 — remover apos 06/abr/2026
const PASCOA_START = new Date('2026-03-28');
const PASCOA_END = new Date('2026-04-06');
const dataEntrada = /* parse da data entrada */;
const dataSaida = /* parse da data saida */;

if (
  dataEntrada >= PASCOA_START &&
  dataSaida <= PASCOA_END &&
  pessoas === 2 &&
  noites === 2
) {
  return {
    tipo: tipo,
    noites: 2,
    pessoas: 2,
    total: 900,
    descricao: 'Pacote Escapada Romantica Pascoa 2026 (cafe incluso)',
    pacote: 'PASCOA_2026'
  };
}
// fim PASCOA_PACKAGE
```

### Implementacao system-prompt.js

Adicionar secao nova ao final do bloco de regras de cotacao:

```
PACOTE PASCOA 2026 (28/mar–06/abr):
- Quando o hospede mencionar Pascoa, abril, feriado ou semana santa,
  apresentar proativamente o Pacote Escapada Romantica.
- Preco especial: R$ 900 (2 noites, 2 pessoas, cafe da manha incluso).
- Usar linguagem romantica e acolhedora, urgencia suave.
- Apos interesse confirmado, perguntar datas e emitir [COTAR:] normalmente.
- Valido apenas para reservas no periodo 28/mar–06/abr/2026.
```

### Arquivos a modificar

| Arquivo | Alteracao | Risco |
|---------|-----------|-------|
| `services/quotation/engine.js` | Adicionar bloco condicional isolado | Baixo |
| `services/luna/system-prompt.js` | Adicionar secao ao prompt | Baixo |
| `tests/` | Adicionar 2 testes Pascoa | Zero |

### Rollback imediato se testes quebrarem

```bash
git revert HEAD
npm test  # verificar 139/139
```

---

## Dependencies

- DEC-004 aprovado (2026-03-10) — prerequisito cumprido
- PLU-02.1 (Meta Ads) em execucao em paralelo — nao blocante
- 139/139 testes passando no branch atual — verificar antes de iniciar

---

## Risks

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Parse de data inconsistente no engine | Alto | Usar mesmo padrao DD/MM/YYYY ja em uso no engine |
| Luna mencionar pacote fora do periodo | Medio | Flag de data no system-prompt garante contexto correto |
| Teste novo conflitar com mock existente | Baixo | Usar padrao dos testes de engine.js existentes |

---

## Definition of Done

- [ ] `engine.js`: bloco PASCOA_PACKAGE adicionado com flag de data
- [ ] `engine.js`: retorna R$900 para 2n/2px no periodo 28/mar–06/abr
- [ ] `engine.js`: retorna preco normal para datas fora do periodo
- [ ] `system-prompt.js`: secao Pascoa adicionada ao prompt
- [ ] 139/139 testes passando (npm test)
- [ ] 2 novos testes Pascoa adicionados
- [ ] Smoke test: enviar "quero ir na Pascoa, 2 pessoas" para o bot

---

## File List

- `services/quotation/engine.js` — adicionar bloco PASCOA_PACKAGE
- `services/luna/system-prompt.js` — adicionar secao Pacote Pascoa
- `tests/` — adicionar testes engine Pascoa

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-10 | 1.0 | Story criada — escopo tecnico DEC-004 | Orion (@aios-master) |
