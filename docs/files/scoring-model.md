# 📊 Scoring Model — Decision Engine

> Critérios detalhados de pontuação para cada C-Level.  
> Use esta referência ao calcular o score de qualquer proposta.

---

## Como aplicar o scoring

Para cada critério, atribua uma nota de **0 a 100**:

| Faixa   | Significado                                  |
|---------|----------------------------------------------|
| 90–100  | Excelente — supera expectativas              |
| 70–89   | Bom — atende bem os critérios                |
| 50–69   | Razoável — atende parcialmente               |
| 30–49   | Fraco — riscos presentes                     |
| 0–29    | Ruim — não recomendado por este C-Level      |

---

## CMO Scoring (peso 25%)

### Critério 1: Potencial de Aquisição (40%)
```
100 = Segmento validado, histórico de conversão > 40%
 80 = Segmento provável, estimativa embasada em dados
 60 = Segmento novo, lógica sólida mas sem histórico
 40 = Segmento incerto, apenas hipótese
 20 = Segmento incompatível com o perfil da pousada
```

### Critério 2: Custo por Lead Esperado (30%)
```
100 = CPL estimado < R$ 15
 80 = CPL estimado R$ 15–25
 60 = CPL estimado R$ 25–40
 40 = CPL estimado R$ 40–60
 20 = CPL estimado > R$ 60
```

### Critério 3: Taxa de Conversão Estimada (20%)
```
100 = Conversão esperada > 50%
 80 = Conversão esperada 35–50%
 60 = Conversão esperada 20–35%
 40 = Conversão esperada 10–20%
 20 = Conversão esperada < 10%
```

### Critério 4: Alinhamento com Sazonalidade (10%)
```
100 = Feriado ou evento confirmado no período
 80 = Alta temporada ou período favorável
 60 = Baixa temporada com potencial de estimular demanda
 40 = Contra-sazonalidade sem justificativa clara
```

**Score CMO = C1×0.40 + C2×0.30 + C3×0.20 + C4×0.10**

---

## CPO Scoring (peso 20%)

### Critério 1: Impacto na Experiência (35%)
```
100 = Resolve problema crítico de UX / aumenta satisfação muito
 80 = Melhoria significativa na jornada do hóspede ou operador
 60 = Melhoria moderada, não crítica
 40 = Impacto neutro na experiência
 20 = Pode piorar algum aspecto da experiência
```

### Critério 2: Alinhamento com Roadmap (30%)
```
100 = Está na lista P1 do roadmap atual
 80 = Alinhado com epic existente
 60 = Relacionado ao roadmap, mas não priorizado
 40 = Novo item sem conexão com epics existentes
 20 = Contradiz direção atual do produto
```

### Critério 3: Complexidade de Implementação (20%)
```
100 = Zero mudança no produto (apenas conteúdo/copy)
 80 = Pequeno ajuste em arquivo existente (< 2h)
 60 = Feature nova em módulo isolado (< 1 dia)
 40 = Feature com múltiplos componentes (< 1 semana)
 20 = Mudança arquitetural grande (> 1 semana)
```

### Critério 4: Prioridade Estratégica (15%)
```
100 = Impacto direto em KPI crítico do CEO
 80 = Suporta KPI secundário importante
 60 = Benefício indireto para objetivos estratégicos
 40 = Benefício marginal
```

**Score CPO = C1×0.35 + C2×0.30 + C3×0.20 + C4×0.15**

---

## CTO Scoring (peso 15%)

### Critério 1: Complexidade Técnica (35%)
```
100 = Sem mudança de código (apenas configuração)
 80 = Mudança simples em arquivo existente
 60 = Nova função/rota isolada
 40 = Integração nova com serviço externo
 20 = Refatoração ou mudança arquitetural
  0 = Mudança que pode derrubar produção (VETO)
```

### Critério 2: Risco de Instabilidade (30%)
```
100 = Zero risco para sistemas em produção
 80 = Risco muito baixo, reversível facilmente
 60 = Risco baixo, com plano de rollback
 40 = Risco médio, requer testes extensivos
 20 = Risco alto, pode afetar Luna/WhatsApp/Supabase
  0 = Risco crítico (VETO — não executa)
```

### Critério 3: Tempo de Implementação (20%)
```
100 = < 2 horas
 80 = 2–8 horas (1 dia)
 60 = 1–3 dias
 40 = 3–7 dias
 20 = > 1 semana
```

### Critério 4: Alinhamento com Arquitetura (15%)
```
100 = Segue exatamente os padrões existentes
 80 = Pequena extensão do padrão atual
 60 = Novo padrão necessário mas compatível
 40 = Requer adaptação da arquitetura
 20 = Contradiz decisões arquiteturais existentes
```

**Score CTO = C1×0.35 + C2×0.30 + C3×0.20 + C4×0.15**  
⚠️ **Se Critério 2 = 0 → VETO TÉCNICO independente do resto**

---

## CFO Scoring (peso 10%)

### Critério 1: ROI Esperado (40%)
```
100 = ROI > 10x em 30 dias
 80 = ROI 5–10x em 30 dias
 60 = ROI 3–5x em 30 dias
 40 = ROI 1.5–3x em 30 dias
 20 = ROI < 1.5x ou prazo > 60 dias
  0 = ROI negativo projetado
```

### Critério 2: Impacto na Margem (30%)
```
100 = Aumenta margem líquida sem custo adicional
 80 = Margem mantida ou melhoria pequena
 60 = Redução de margem < 5% justificada por volume
 40 = Redução de margem 5–15%
 20 = Redução de margem > 15%
```

### Critério 3: Risco Financeiro (20%)
```
100 = Custo zero ou simbólico (< R$ 100)
 80 = Custo baixo (R$ 100–500), recuperável rapidamente
 60 = Custo médio (R$ 500–2000), ROI claro
 40 = Custo alto (R$ 2000–5000), ROI incerto
 20 = Custo muito alto ou ROI imprevisível
```

### Critério 4: Velocidade de Retorno (10%)
```
100 = Retorno em < 7 dias
 80 = Retorno em 7–15 dias
 60 = Retorno em 15–30 dias
 40 = Retorno em 30–60 dias
 20 = Retorno em > 60 dias
```

**Score CFO = C1×0.40 + C2×0.30 + C3×0.20 + C4×0.10**

---

## CEO Scoring (peso 30%)

O CEO avalia com Pareto³ + visão estratégica:

### Critério 1: Impacto no KPI principal (40%)
```
100 = Resolve o KPI mais crítico do momento
 80 = Melhora significativamente KPI importante
 60 = Impacto indireto em KPIs
 40 = Impacto marginal
 20 = Sem impacto mensurável em KPIs
```

### Critério 2: Urgência / Timing (30%)
```
100 = Janela de oportunidade fecha em < 7 dias
 80 = Oportunidade ativa por 7–15 dias
 60 = Pode ser feito esta semana
 40 = Pode esperar este mês
 20 = Sem urgência
```

### Critério 3: Alinhamento estratégico (30%)
```
100 = Diretamente alinhado com objetivo da pousada agora
 80 = Suporta objetivo de médio prazo
 60 = Benefício indireto
 40 = Neutro estrategicamente
 20 = Distrai do objetivo principal
```

**Score CEO = C1×0.40 + C2×0.30 + C3×0.30**
