# 🔄 Workflow Completo — AI OS em Operação

> Exemplo real e detalhado de como o sistema opera de ponta a ponta  
> aplicado à Pousada Luz da Lua.

---

## Workflow 1: Baixa Ocupação Detectada

**Gatilho:** Demand Prediction detecta ocupação prevista < 50% para feriado em 15 dias.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 1 — DETECÇÃO (automático)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Demand Prediction Engine monitora:
  → revenue-analytics.js → ocupação atual: 38%
  → Calendário → feriado Tiradentes em 12 dias
  → Histórico → média histórica deste feriado: 72%
  
ALERTA 🔴 CRÍTICO gerado automaticamente:
  "Ocupação 38% prevista vs. meta 75% — feriado em 12 dias"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 2 — ANÁLISE CEO (Pareto³)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CEO Agent recebe o alerta
  → Aplica Pareto³: esta é a ação de maior impacto agora?
  → SIM — ocupação é o KPI principal da pousada
  
CEO submete proposta ao Decision Engine:
  ID: DEC-019
  Tipo: Marketing
  Proposta: Campanha "Feriado de Tiradentes" com 12% desconto
  Urgência: Alta — 12 dias

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 3 — DECISION ENGINE (votação)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Board analisa a proposta:

CEO: 85  → Impacto direto em KPI crítico, urgente
CMO: 80  → Segmento casal bem definido, CPL estimado ok
CPO: 75  → Funil existente suporta, sem mudança de produto
CTO: 95  → Zero mudança técnica
CFO: 65  → Margem ok com 12% desconto, ROI estimado 4.5x

Score Final:
(85×0.30) + (80×0.25) + (75×0.20) + (95×0.15) + (65×0.10)
= 25.5 + 20 + 15 + 14.25 + 6.5 = 81.25 ✅ APROVADO

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 4 — STRATEGY ENGINE (planejamento)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Strategy Engine cria plano em 5 dias:

Dia 1 — Copy Squad:
  → Ads Copywriter: 3 variações de copy para anúncio
  → Landing Page Writer: revisar texto de reservas
  → Oferta: "Escapa de Tiradentes — 12% off + late checkout"

Dia 2 — Revenue Squad:
  → Pricing Optimizer: configurar desconto no quotation/engine.js
  → CFO valida margem da oferta

Dia 3 — Growth Squad:
  → Media Buyer: criar campanha Meta Ads
  → Segmentação: casais 25–45 anos, 100–180km de Socorro
  → Orçamento: R$ 600 (3 dias de campanha)

Dia 4 — Growth Squad:
  → Ativar campanha
  → Analytics: monitorar primeiras 12h

Dia 5 — Otimização:
  → Analytics reporta CPL e leads
  → Pausar variações abaixo da média
  → Escalar variação vencedora

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 5 — EXECUÇÃO (squads + sistema existente)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copy Squad usa:
  → services/follow-up/templates/ (padrões existentes)
  → services/luna/system-prompt.js (tom da Luna)

Growth Squad aciona:
  → agents/ads-agent.md (configuração de anúncios)

Revenue Squad atualiza:
  → services/quotation/engine.js (preço com desconto)

Leads chegam pelo WhatsApp:
  → Luna responde automaticamente (services/luna/)
  → CRM registra (services/crm/)
  → Follow-up automático ativado (services/follow-up/)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 6 — MEDIÇÃO (data feedback loop)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analytics Agent coleta:
  → CPL real: R$ 18 ✅ (meta < R$ 25)
  → Leads gerados: 23
  → Conversão: 39% = 9 reservas
  → Ocupação final: 71% ✅ (meta 70%)
  → Receita gerada: R$ 4.800
  → ROI: 8x vs. investimento de R$ 600

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ETAPA 7 — APRENDIZADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Resultado registrado em:
  data/decision-history/DEC-019.md

Aprendizados:
  → Segmento casais 25–45 / 100–180km funciona bem
  → Copy com "late checkout" como benefício tem boa conversão
  → Orçamento ideal: R$ 200/dia para este feriado
  → Próximo feriado similar: começar campanha 20+ dias antes
  
Esse aprendizado melhora o score do Decision Engine na próxima vez.
```

---

## Workflow 2: Proprietário faz pedido direto

**Gatilho:** Proprietário diz "Quero lançar um pacote para o Dia dos Namorados".

```
Founder → AIOS Master → CEO Agent
  ↓
CEO aplica Pareto³:
  → KPI atual: ocupação em 65% (dentro do ok)
  → Dia dos Namorados em 45 dias
  → Oportunidade: aumentar ocupação E ticket médio
  → AÇÃO CRÍTICA: pacote premium Dia dos Namorados
  ↓
CEO submete ao Decision Engine:
  Proposta: Pacote "Noite dos Sonhos" — 2 noites com experiências
  ↓
Board vota → aprovado
  ↓
Strategy Engine cria plano:
  → CPO: criar página do pacote (public/proposals.html)
  → Copy Squad: texto e criativo romântico
  → CFO: pricing do pacote (margem ≥ 40%)
  → CMO: campanha segmento casal
  ↓
Execução → Luna ativa oferta no WhatsApp
  ↓
Resultado registrado + aprendizado
```

---

## Ciclo Operacional Semanal

```
Segunda-feira:
  → Demand Prediction gera relatório semanal
  → CEO analisa alertas e prioridades
  → Decision Engine processa propostas pendentes

Terça a Quinta:
  → Squads executam planos aprovados
  → Analytics monitora campanhas em andamento

Sexta-feira:
  → Analytics Agent gera relatório de performance
  → CFO avalia receita e margem da semana
  → CEO registra aprendizados + ajusta prioridades próxima semana

Domingo (automático):
  → Demand Prediction atualiza previsão dos próximos 30 dias
  → Revenue Engine recalcula preços para próxima semana
  → Alertas gerados para CEO na segunda-feira
```
