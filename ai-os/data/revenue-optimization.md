# 💹 Revenue Optimization Engine — Maximização de Receita

> Motor de precificação dinâmica e otimização de receita.
> Trabalha em conjunto com o CFO Agent e o Demand Prediction Engine.

---

## Mission

Garantir que cada quarto seja vendido pelo preço ótimo:
nem tão alto que impeça reservas, nem tão baixo que desperdice margem.

---

## Arquitetura do Motor

```
Demand Prediction Engine
        ↓
Revenue Optimization Engine
        ↓
┌──────────────────────────────────────┐
│  Recomendações de preço             │
│  ├── Preço base ajustado             │
│  ├── Desconto máximo permitido       │
│  ├── Pacotes recomendados            │
│  └── Estratégia de upsell           │
└──────────────────────────────────────┘
        ↓
CFO Agent aprova ou ajusta
        ↓
Atualizado em services/quotation/engine.js
```

---

## Regras de Dynamic Pricing

### Por Taxa de Ocupação Atual

```
Ocupação atual     → Ação de preço
─────────────────────────────────────
> 95%              → +25% no preço base
85–95%             → +15% no preço base
70–85%             → Preço base (sem mudança)
55–70%             → -5% (desconto sutil)
40–55%             → -10% (desconto moderado)
25–40%             → -15% (promoção ativa)
< 25%              → -20% + pacote especial
```

### Por Antecedência da Reserva

```
Reserva feita com    → Ajuste
─────────────────────────────────────
> 60 dias           → -5% (early bird)
30–60 dias          → Preço base
15–30 dias          → Preço base
7–15 dias           → +5% (demanda confirmada)
3–7 dias            → +10% ou -15% (depende da ocupação)
< 3 dias            → Regra de última hora (ver abaixo)
```

### Regra de Última Hora (< 3 dias)

```
Se ocupação > 70%  → +15% (quarto raro, vale mais)
Se ocupação 40–70% → -10% (melhor vender do que deixar vazio)
Se ocupação < 40%  → -20% + brinde (ex: café da manhã incluso)
```

---

## Multiplicadores por Tipo de Período

| Período                            | Multiplicador | Observação                    |
|------------------------------------|---------------|-------------------------------|
| Feriados nacionais prolongados     | × 1.30        | Independente de ocupação      |
| Feriados simples (ponte 2 dias)    | × 1.20        | Aplicar com 30 dias de antec. |
| Reveillon e Carnaval               | × 1.50        | Máximo da pousada             |
| Eventos do Circuito das Águas      | × 1.15        | Monitorar impacto real        |
| Férias escolares (Jan, Jul, Dez)   | × 1.25        | Segmento familiar             |
| Dia dos Namorados (12/6)           | × 1.35        | Segmento casal — pico         |
| Dia das Mães (2º Dom de Mai)       | × 1.20        | Segmento casal/família        |
| Dia dos Pais (2º Dom de Ago)       | × 1.10        | Segmento família              |
| Final de semana comum              | × 1.05        | Leve ajuste vs. semana        |
| Dias de semana (seg–qui)           | × 0.90        | Estimular demanda low-season  |

---

## Estratégia de Pacotes por Cenário

### Cenário 1: Baixa Ocupação (< 50%)
```
Pacote Valor Especial:
  → Inclui café da manhã sem custo adicional
  → Late checkout (12h → 14h) gratuito
  → Desconto de 10–15% na diária
  → Comunicação: "Aproveite antes de lotar"
```

### Cenário 2: Feriado com Potencial (30+ dias)
```
Pacote Temático:
  → Nome especial (ex: "Escapada de Páscoa")
  → 2 noites mínimo para desconto
  → Inclui experiência (jantar especial, café romântico)
  → Preço apresentado como "valor especial por tempo limitado"
```

### Cenário 3: Alta Demanda (> 80%)
```
Upsell Ativo:
  → Oferecer upgrade de quarto (+R$ 80–150/noite)
  → Pacote all-inclusive premium
  → Lista de espera para quartos disponíveis
  → Early bird para próxima data
```

### Cenário 4: Semana Vazia (seg–qui < 30%)
```
Pacote Retiro / Home Office:
  → 3+ noites = desconto progressivo (5%, 10%, 15%)
  → Wi-fi, café incluso
  → Segmento: profissionais remotos, casais sem filhos
```

---

## Limites Absolutos (nunca cruzar)

```
Desconto máximo sem aprovação CEO:    15%
Desconto máximo com aprovação CEO:    25%
Preço mínimo absoluto (floor):        R$ [definir com proprietário]
Preço máximo (ceiling):               R$ [definir com proprietário]
Desconto acumulado máximo:            25% (não cumular promoções)
```

---

## Integração com Sistema Existente

### Onde aplica as regras

```javascript
// Ponto principal de integração:
services/quotation/engine.js
  → ajustar lógica de cálculo de diária baseado nas regras acima

// Histórico para base de cálculo:
services/analytics/revenue-analytics.js
  → ocupação atual e histórica

// Alertas financeiros:
services/alerts/alert-calculator.js
  → disparar quando preço sair dos limites

// Resultado para o hóspede via Luna:
services/luna/system-prompt.js
  → Luna usa o preço calculado pelo engine ao cotar
```

---

## Relatório de Receita — CFO Template

Gerado semanalmente:

```markdown
# Relatório Financeiro — Semana XX

## Ocupação Atual: X%
## Receita da Semana: R$ X.XXX
## RevPAR: R$ XXX
## Ticket Médio: R$ X.XXX
## Desconto Médio Aplicado: X%

## Comparativo
Semana anterior: R$ X.XXX (▲/▼ X%)
Mesmo período ano anterior: R$ X.XXX

## Projeção 30 dias
Receita projetada: R$ XX.XXX
Ocupação esperada: XX%

## Ações Recomendadas pelo Revenue Engine
1. [ação sugerida com impacto estimado]
2. [ação sugerida]
```
