# Orquestracao AIOS v2 — Loop BPEC

## Fluxo Obrigatorio

VITOR
  ↓ problema
ORION @aios-master (Planner)
  ↓ quebra em tasks, escreve no blackboard
EVA @secretary (Task Router)
  ↓ documenta gaveta, direciona com contexto minimo
EXECUTOR (squad correto)
  ↓ executa, escreve em execution_results
RAY @critic (Critic)
  ↓ LGTM → segue | REPROVAR → volta ao executor (max 3x)
EVA @secretary (Memory)
  ↓ arquiva gaveta, atualiza QUADRONEGRO
ORION
  ↓ confirma ao Vitor
VITOR ✅

## Regras do Loop
1. Max 3 iteracoes por tarefa
2. Contexto minimo — cada agente so recebe o necessario
3. Blackboard e a fonte da verdade
4. QUADRONEGRO gerado ao arquivar cada gaveta
5. Fim do dia = gavetas/abertas/ VAZIA

## Regra Global de Tokens
ECONOMIZE SEMPRE.
Se precisar gastar para entregar qualidade: OK.
Prefira DeepSeek/opensource quando disponivel no .env
Sem preamble. Sem repeticao. Resposta minima necessaria.

## Regras Imutaveis
- Nenhum codigo sem DEC
- Vitor aprova N1 e N2
- CTO veta score < 40
- 179/179 antes de deploy