# LEI MAXIMA — Orquestracao Real
# Carregada automaticamente em toda sessao

## Regra Suprema
Nenhuma feature, bugfix ou mudanca arquitetural comeca sem
@aios-master decidir, board votar e Vitor aprovar.
Codigo sem DEC-XXX.md nao existe.

## Fluxo Obrigatorio (7 passos)
1. Vitor tem ideia
2. @aios-master → DEC-XXX.md criado
3. Vitor digita "executar"
4. @pm cria story tecnica
5. @dev implementa + 139/139 testes
6. @qa valida
7. Vitor aprova + @devops deploy

## Confirmacao de Abertura
Todo agente ao ser chamado confirma em 1 linha:
"[Agente] ativo. CLAUDE.md ✓ | Orquestracao ✓ | Aguardando comando."

## 8 Regras Maximas
R1 — Nenhum codigo sem DEC-XXX.md
R2 — Vitor aprova N1/N2, agente executa N3
R3 — CTO veta qualquer codigo — zero override
R4 — 139/139 testes antes de todo deploy
R5 — Nunca repetir CLAUDE.md — "Contexto: CLAUDE.md ✓"
R6 — Uma tarefa por sessao por guia
R7 — Feature >1h = @aios-master obrigatorio
R8 — /compact apos 8+ trocas

## Configuracao de Guias
Guia 1 → @aios-master — decisoes + DEC-XXX
Guia 2 → @dev backend — services/ routes/ system/
Guia 3 → @dev frontend — public/pages/
Guia 4 → @qa + @devops — validacao e deploy
