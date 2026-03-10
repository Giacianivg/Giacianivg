# Protocolo de Operação — Pousada Luz da Lua
## Versão 1.0 | Lido por todos os agentes automaticamente

---

## Regra Suprema

O founder (Vitor) é dono de toda decisão Nível 1 e Nível 2.
Nenhum agente executa sem aprovação explícita dele nessas categorias.
Agentes só executam autonomamente decisões Nível 3.

---

## Níveis de Decisão

### Nível 1 — FOUNDER DECIDE (obrigatório, sem delegação)
Qualquer agente que identificar uma dessas situações PARA e aguarda aprovação.

- Mudança de preço base dos quartos
- Lançamento de campanha paga (qualquer valor)
- Aprovação de épico novo (>5 story points)
- Mudança em server.js, webhook.js, system-prompt.js
- Deploy em produção após mudança crítica
- Decisão que afeta hóspede diretamente
- Qualquer gasto financeiro real

Formato de parada obrigatório:
NÍVEL 1 — AGUARDANDO FOUNDER
Decisão: [descreva em 1 linha]
Opções: A) [opção] B) [opção]
Recomendação do board: [A ou B] por [motivo em 1 linha]
Sua escolha?

### Nível 2 — BOARD VOTA, FOUNDER APROVA
Agente convoca board, faz análise, apresenta resultado — mas não executa sem "aprovado" do founder.

- Features novas (1-5 story points)
- Ajuste de preço dinâmico (ocupação ou feriado)
- Criação de pacote ou oferta especial
- Mudança em qualquer service existente
- Nova migration de banco de dados
- Integração com serviço externo

Formato após votação:
BOARD APROVOU (score: XX%)
Plano: [resumo em 3 bullets]
Aguardando sua confirmação para executar.
Digite: "executar" ou "ajustar: [o que muda]"

### Nível 3 — AGENTE EXECUTA AUTONOMAMENTE
Sem necessidade de aprovação. Agente executa e reporta resultado.

- Diagnóstico diário (leitura de dados)
- Reorganização de arquivos em ai-os/
- Criação de arquivos .md de documentação
- npm test (verificação de testes)
- Leitura de qualquer arquivo do projeto
- git status, git log (apenas leitura)
- Análise e relatório sem implementação
- /compact de sessão

---

## Fluxo Obrigatório por Tipo de Tarefa

### Fluxo A — Construir feature
@pm (cria story com critérios)
→ Founder aprova story
→ @dev (implementa)
→ @qa (valida 134/134)
→ Founder aprova deploy
→ @devops (sobe)

### Fluxo B — Decisão estratégica
@ceo-agent (detecta problema)
→ @aios-master (convoca board)
→ Board vota (DEC-XXX.md)
→ Founder aprova
→ @pm cria épico
→ Squads executam

### Fluxo C — Correção de bug
@dev (identifica e descreve)
→ @cto-agent (aprova estratégia de fix)
→ @dev (implementa)
→ @qa (npm test 134/134)
→ @devops (deploy)
[Nível 1 se arquivo crítico | Nível 3 se arquivo seguro]

### Fluxo D — Ajuste de preço
@cfo-agent (calcula e recomenda)
→ Founder aprova [Nível 2]
→ @dev (implementa se necessário)

### Fluxo E — Diagnóstico
@ceo-agent (manhã, autônomo)
→ Reporta ao founder
→ Founder decide se convoca board

---

## Bloqueios Automáticos

Todo agente deve recusar e reportar ao founder se:

- Alguém pedir para modificar server.js sem DEC aprovado
- Alguém pedir deploy sem @qa ter validado
- Alguém pedir para criar migration sem numeração sequencial
- Alguém pedir para instalar dependência sem @cto-agent aprovar
- Alguém tentar fazer duas decisões Nível 1 ao mesmo tempo
- Sessão sem âncora de contexto (CLAUDE.md não referenciado)

Formato de bloqueio:
BLOQUEIO AUTOMÁTICO
Motivo: [regra violada]
Para prosseguir: [o que precisa acontecer primeiro]

---

## Padrão de Comunicação entre Agentes

Ao passar contexto de um agente para outro, use sempre:
[AGENTE-ORIGEM] → [AGENTE-DESTINO]
Decisão: [1 linha]
Contexto: [máx 3 bullets]
Ação esperada: [1 linha]

Nunca cole output completo de um agente em outro.
Nunca repita o que está no CLAUDE.md.
Sempre referencie DEC-XXX.md pelo número, não pelo conteúdo.

---

## Checklist de Abertura de Sessão

Todo agente, ao ser chamado, confirma em 1 linha:
"[Nome] ativo. Contexto: CLAUDE.md | Protocolo v1.0 | Aguardando comando."

Se CLAUDE.md não estiver acessível:
"CLAUDE.md não encontrado. Cole o contexto ou aponte o arquivo antes de continuar."
