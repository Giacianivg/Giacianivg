# 🚀 Guia de Implementação — AI OS no Projeto Existente

> Como adicionar o AI OS ao seu projeto sem tocar em nada que já funciona.

---

## PASSO 1 — Copiar a pasta ai-os para o seu projeto

```bash
# Na raiz do seu projeto (onde está server.js):
cp -r ai-os/ ./ai-os/

# Verificar estrutura:
ls ai-os/
# board/  data/  decision-engine/  docs/  
# squads/  strategy-engine/  workflows/  agents/  README.md
```

---

## PASSO 2 — Atualizar o .gitignore (verificar)

```bash
# Garantir que esses arquivos NÃO estejam sendo ignorados:
# ai-os/ deve estar rastreado pelo git (é documentação/prompts)

# Verificar:
cat .gitignore | grep ai-os
# Se aparecer "ai-os", remover essa linha
```

---

## PASSO 3 — Integrar com o AIOS Master existente

No seu arquivo de configuração do AIOS Master (`.aios-core/`),  
adicione referência ao CEO Agent como camada de decisão estratégica:

```markdown
# Adicionar ao AIOS Master existente:

## Camada Estratégica
Antes de executar qualquer ação de impacto significativo,
consultar o CEO Agent em: ai-os/board/ceo-agent.md

Critério de "impacto significativo":
- Qualquer campanha paga
- Mudança de preço ou desconto > 5%
- Nova feature no produto
- Mudança em produção (deploy)
- Decisão que afeta receita diretamente
```

---

## PASSO 4 — Atualizar agents/ads-agent.md

Adicione ao final do arquivo existente:

```markdown
---
## Integração com AI OS

Este agente é acionado pelo **Growth Squad** após aprovação
do **Decision Engine**. 

Ao receber uma campanha para executar:
1. Verificar se existe DEC-XXX aprovado em ai-os/data/decision-history/
2. Seguir o plano gerado pelo Strategy Engine
3. Reportar resultados ao Analytics Agent do Revenue Squad
```

---

## PASSO 5 — Conectar analytics ao Demand Prediction

O Demand Prediction Engine precisa dos dados de  
`services/analytics/revenue-analytics.js`.

Não mude nada no arquivo existente. Apenas documente  
que o Demand Prediction Engine lê esses dados:

```javascript
// Em services/analytics/revenue-analytics.js
// NENHUMA MUDANÇA NECESSÁRIA
// O Demand Prediction Engine (ai-os/data/demand-prediction.md)
// lê os dados que este serviço já produz.
```

---

## PASSO 6 — Criar primeira decisão de teste

Crie um arquivo de decisão para validar o fluxo:

```bash
cp ai-os/data/decision-history/DEC-TEMPLATE.md \
   ai-os/data/decision-history/DEC-001.md
```

Preencha DEC-001 com uma decisão real que você queira tomar  
e passe pelo processo do Decision Engine para testar o fluxo.

---

## PASSO 7 — Adicionar ao Claude Project (AIOS Master)

No seu Claude Project (custom instructions), adicione referência ao AI OS:

```
## AI Operating System
O sistema possui uma camada estratégica em ai-os/.

Para decisões estratégicas:
→ ai-os/board/ceo-agent.md (CEO e Pareto³)
→ ai-os/decision-engine/decision-engine.md (votação)
→ ai-os/strategy-engine/strategy-engine.md (planos)

Para análise de mercado e receita:
→ ai-os/data/demand-prediction.md
→ ai-os/data/revenue-optimization.md

Para execução:
→ ai-os/squads/ (cada squad especializado)
→ ai-os/workflows/ (exemplos completos)
```

---

## O que NÃO fazer

```
❌ NÃO modificar server.js
❌ NÃO alterar routes/ existentes
❌ NÃO mudar services/luna/system-prompt.js
❌ NÃO editar services/whatsapp/webhook.js
❌ NÃO criar nova migration sem numerar (007+)
❌ NÃO commitar .env
❌ NÃO fazer deploy sem testar localmente
```

---

## Checklist de Implementação

```
[ ] Pasta ai-os/ copiada para a raiz do projeto
[ ] .gitignore verificado (ai-os/ não ignorado)
[ ] AIOS Master atualizado com referência ao CEO Agent
[ ] agents/ads-agent.md atualizado (apenas adição ao final)
[ ] DEC-001.md criado como primeiro teste
[ ] Claude Project atualizado com referência ao AI OS
[ ] Primeiro fluxo testado (proposta → votação → plano)
```

---

## Ordem recomendada de uso

**Semana 1:** Familiarize-se com CEO Agent + Decision Engine  
**Semana 2:** Use o Demand Prediction Engine na sua próxima decisão  
**Semana 3:** Ative o Revenue Optimization Engine para dynamic pricing  
**Semana 4+:** Sistema operando em ciclo completo autônomo
