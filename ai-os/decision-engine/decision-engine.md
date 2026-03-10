# ⚖️ Decision Engine — Sistema de Votação do AI Board

> Módulo de governança algorítmica.
> Toda decisão estratégica importante passa por aqui antes de ser executada.

---

## Mission

Garantir que decisões importantes sejam avaliadas por múltiplas perspectivas
antes de virar ação, eliminando vieses e priorizando o que realmente importa.

---

## Como Funciona

```
1. CEO recebe proposta ou detecta oportunidade
            ↓
2. CEO submete proposta ao Decision Engine
            ↓
3. Decision Engine envia para cada C-Level avaliar
            ↓
4. Cada C-Level dá um score de 0–100 com justificativa
            ↓
5. Decision Engine calcula score ponderado final
            ↓
6. Decisão: APROVADO / REVISÃO / REJEITADO
            ↓
7. Se aprovado → Strategy Engine cria plano de execução
8. Resultado registrado em decision-history/
```

---

## Pesos de Votação

```
CEO  = 30%  (visão estratégica e Pareto³)
CMO  = 25%  (impacto em marketing e aquisição)
CPO  = 20%  (impacto no produto e experiência)
CTO  = 15%  (viabilidade técnica)
CFO  = 10%  (retorno financeiro)
```

### Fórmula

```
Score Final = (CEO×0.30) + (CMO×0.25) + (CPO×0.20) + (CTO×0.15) + (CFO×0.10)
```

---

## Thresholds de Decisão

| Score Final | Status       | Ação                                          |
|-------------|--------------|-----------------------------------------------|
| ≥ 75        | ✅ APROVADO   | Execução imediata — Strategy Engine acionado  |
| 55–74       | 🟡 REVISÃO   | Aprovado com condições — CEO define ajustes   |
| 40–54       | ⏳ AGUARDA   | Requer mais dados — adiar para próximo ciclo  |
| < 40        | ❌ REJEITADO  | Arquivar — não executa                        |

### Veto Técnico (CTO)
> Se o score do CTO for < 30, a proposta é bloqueada independente do score final.
> Motivo: risco técnico alto pode derrubar o sistema em produção.

---

## Template de Proposta

Toda proposta submetida ao Decision Engine deve conter:

```markdown
## Proposta: [TÍTULO]

**ID:** DEC-XXX
**Data:** YYYY-MM-DD
**Solicitante:** Founder / Sistema (automático)
**Tipo:** Marketing | Produto | Tecnologia | Receita | Operação

### Descrição
[O que se quer fazer — máximo 3 linhas]

### Problema que resolve
[Qual KPI está ruim ou qual oportunidade foi detectada]

### Impacto esperado
[Resultado mensurável esperado]

### Custo/Esforço estimado
[Tempo, dinheiro, complexidade]

### Prazo
[Urgência: imediato / esta semana / este mês]
```

---

## Template de Voto

Cada C-Level preenche ao avaliar:

```markdown
## Voto: [NOME DO C-LEVEL]

**Proposta:** DEC-XXX
**Score:** [0–100]

### Análise
[Avaliação segundo os critérios do seu papel]

### Pontos Positivos
- [item 1]
- [item 2]

### Riscos ou Ressalvas
- [item 1]

### Condições (se score 55–74)
- [o que precisa mudar para aprovação plena]

### Voto Final
✅ Aprovo / 🟡 Aprovo com ressalvas / ❌ Rejeito
```

---

## Exemplo Completo — Campanha Feriado

### Proposta submetida
```
ID: DEC-014
Tipo: Marketing
Descrição: Campanha "Escapada de Feriado" com 15% de desconto
Problema: Ocupação prevista de 42% para o feriado de 18/04
Impacto: Aumentar ocupação para ≥ 70%
Custo: R$ 800 em anúncios Meta
Prazo: Lançar em 5 dias
```

### Votos dos C-Levels

| C-Level | Score | Justificativa resumida                               |
|---------|-------|------------------------------------------------------|
| CEO     | 82    | Alta prioridade pelo Pareto³ — ocup. < 50%          |
| CMO     | 85    | CPL estimado < R$ 20, segmento casal tem boa conv.  |
| CPO     | 70    | Funil existente suporta, sem mudança técnica         |
| CTO     | 95    | Zero mudança técnica necessária                      |
| CFO     | 60    | Margem ok com 15% desconto, ROI ≥ 3x estimado       |

### Cálculo
```
Score Final = (82×0.30) + (85×0.25) + (70×0.20) + (95×0.15) + (60×0.10)
           = 24.6 + 21.25 + 14.0 + 14.25 + 6.0
           = 80.1 ✅ APROVADO
```

### Decisão
> **APROVADO** — Strategy Engine acionado para criar plano de execução.

---

## Histórico de Decisões

Cada decisão é salva em:
```
ai-os/data/decision-history/DEC-XXX.md
```

Campos obrigatórios no histórico:
- ID, Data, Proposta, Scores, Score Final, Status
- Resultado real (preenchido após execução)
- Aprendizado (o que funcionou ou não)

---

## Integrações

| Etapa                    | Sistema existente envolvido                      |
|--------------------------|--------------------------------------------------|
| Detectar problema        | `services/analytics/revenue-analytics.js`       |
| Dados para votação CFO   | `services/analytics/funnel-analytics.js`        |
| Dados para votação CMO   | `agents/ads-agent.md`                           |
| Dados para votação CTO   | `docs/architecture/`                            |
| Execução após aprovação  | `ai-os/strategy-engine/strategy-engine.md`      |
| Registro do resultado    | `ai-os/data/decision-history/`                  |
