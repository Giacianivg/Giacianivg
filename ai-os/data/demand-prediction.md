# 🔮 Demand Prediction Engine — Motor de Previsão de Demanda

> Detecta riscos de baixa ocupação e oportunidades de demanda
> antes que o problema aconteça, alimentando o Decision Engine automaticamente.

---

## Mission

Prever a ocupação futura dos próximos 60 dias usando múltiplas fontes de dados,
gerar alertas automáticos e propor ações ao CEO antes de qualquer problema financeiro.

---

## Fontes de Dados

### 1. Dados Internos (sistema existente)
```
services/analytics/revenue-analytics.js
  → ocupação histórica por período
  → receita por mês/semana
  → padrões de sazonalidade

services/analytics/funnel-analytics.js
  → volume de leads por período
  → taxa de conversão histórica
  → tempo médio lead → reserva

services/crm/index.js
  → reservas confirmadas
  → reservas pendentes
  → leads em negociação
```

### 2. Calendário de Feriados Brasileiros
```
Feriados nacionais 2024–2025:
Jan: Ano Novo (1/1), Carnaval (Fev), Tiradentes (21/4)
Mai: Dia do Trabalho (1/5)
Jun: Corpus Christi (variável)
Set: Independência (7/9)
Out: Nossa Senhora Aparecida (12/10)
Nov: Finados (2/11), Proclamação (15/11)
Dez: Natal (25/12), Reveillon (31/12)
```

### 3. Eventos do Circuito das Águas Paulista
```
Cidades monitorar:
- Socorro/SP (sede da pousada)
- Águas de Lindóia
- Serra Negra
- Amparo
- Monte Alegre do Sul

Tipos de evento:
- Festivais gastronômicos
- Corridas e eventos esportivos
- Festas juninas / folclóricas
- Exposições agropecuárias
- Eventos culturais e shows
```

### 4. Dados Climáticos
```
Padrão identificado para região de Socorro/SP:
- Chuva leve → aumenta procura por hospedagem (clima aconchegante)
- Chuva forte / temporal → reduz reservas de última hora
- Tempo ensolarado → pico de reservas
- Inverno (Jun–Ago) → alta temporada para casais
- Verão (Dez–Mar) → alta temporada para famílias
```

---

## Modelo de Previsão

### Fórmula Base
```
Ocupação Prevista =
  Média Histórica do Período
  × Fator Feriado
  × Fator Evento Regional
  × Fator Clima
  × Fator Tendência Atual (leads em aberto)
```

### Fatores Multiplicadores

| Condição                              | Fator   |
|---------------------------------------|---------|
| Feriado prolongado (4+ dias)          | × 1.35  |
| Feriado simples (1–2 dias)            | × 1.20  |
| Evento regional de grande porte       | × 1.25  |
| Evento regional de médio porte        | × 1.10  |
| Sem feriado ou evento                 | × 1.00  |
| Tempo ensolarado previsto             | × 1.05  |
| Chuva forte prevista                  | × 0.90  |
| Alta temporada base                   | × 1.15  |
| Baixa temporada base                  | × 0.85  |

---

## Sistema de Alertas

### Níveis de Alerta

```
🔴 CRÍTICO — Alerta Imediato
  Ocupação prevista < 40% em janela de 0–10 dias
  → Acionar CEO imediatamente
  → Decision Engine recebe proposta de campanha urgente

🟡 ATENÇÃO — Alerta Proativo
  Ocupação prevista 40–60% em janela de 11–21 dias
  → CEO avalia e submete ao Decision Engine
  → Tempo suficiente para campanha normal

🟢 OPORTUNIDADE — Alerta de Crescimento
  Feriado ou evento detectado em 22–60 dias com ocupação < 80%
  → Sinalizar para CMO planejar campanha temática
  → Potencial de maximizar receita

⚡ PICO — Alerta de Alta Demanda
  Ocupação prevista > 85% em qualquer janela
  → Alertar CFO para ativar dynamic pricing (+10% a +20%)
  → Avaliar lista de espera
```

---

## Relatório Semanal de Previsão

Gerado toda segunda-feira para o CEO:

```markdown
# Relatório de Previsão — Semana XX/XXXX

## Próximos 7 dias
| Data       | Dia     | Feriado/Evento        | Ocupação Prevista | Alerta |
|------------|---------|----------------------|-------------------|--------|
| YYYY-MM-DD | Sex     | -                    | 65%               | 🟢     |
| YYYY-MM-DD | Sáb     | -                    | 78%               | 🟢     |
| YYYY-MM-DD | Dom     | -                    | 72%               | 🟢     |

## Próximos 8–30 dias
| Semana     | Evento/Feriado            | Ocupação Prevista | Ação Recomendada         |
|------------|---------------------------|-------------------|--------------------------|
| 15–21/04   | Feriado Tiradentes        | 42%               | 🔴 Campanha urgente      |
| 22–28/04   | Sem evento                | 55%               | 🟡 Follow-up de leads    |
| 29/04–05/05| Feriado Trabalho          | 70%               | 🟢 Monitorar             |

## Próximos 31–60 dias
[Previsões de médio prazo]

## Ações Recomendadas ao CEO
1. 🔴 DEC-XXX: Campanha feriado 18/04 — submeter ao Decision Engine HOJE
2. 🟡 Preparar pacote Dia das Mães (14/05) — planejar esta semana
```

---

## Integração com Decision Engine

Quando o Demand Prediction Engine detecta um alerta 🔴 ou 🟡,
ele gera automaticamente uma proposta no formato padrão do Decision Engine:

```markdown
## Proposta Automática: Campanha [PERÍODO]

**ID:** DEC-AUTO-XXX (gerado pelo sistema)
**Origem:** Demand Prediction Engine (automático)
**Tipo:** Marketing

### Problema detectado
Ocupação prevista: [X]% para [período]
Meta: ≥ 70%

### Impacto esperado
[cálculo de receita perdida vs. receita possível]

### Proposta de ação
[tipo de campanha recomendada pelo histórico]
```

---

## Conexão com Sistema Existente

```javascript
// Dados que o Demand Prediction Engine consome:

// 1. Ocupação histórica
services/analytics/revenue-analytics.js

// 2. Leads e conversão
services/analytics/funnel-analytics.js

// 3. Reservas confirmadas
services/crm/index.js

// 4. Alertas existentes
services/alerts/alert-calculator.js  // estende este serviço

// 5. Calendário
public/calendar.html  // integra com esta visualização
```

---

## Evolução Futura

Quando o sistema tiver dados suficientes (90+ dias de histórico):
- Treinar modelo preditivo baseado em padrões reais da pousada
- Integrar API de clima (OpenWeatherMap ou similar)
- Integrar API de eventos da região (Google Events, Sympla)
- Dashboard de previsão em `public/dashboard.html`
