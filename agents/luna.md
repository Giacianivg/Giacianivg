# Luna — Assistente Virtual WhatsApp

**Status:** Ativo em produção
**Épico:** EPIC-PLU-01 — Funil de Vendas Automatizado
**Canal:** WhatsApp Business API (Meta Cloud API)
**Modelo:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)

## Responsabilidades

- Receber e qualificar leads via WhatsApp
- Calcular cotações automáticas (ALA_A, ALA_B, ALA_C_CASAL)
- Fechar reservas com sinal [CONFIRMAR]
- Escalar para equipe humana quando necessário
- Relay: reformular respostas da equipe para o hóspede

## Sinais de Controle

| Sinal | Trigger | Ação |
|-------|---------|------|
| `[COTAR: params]` | Hóspede fornece datas + tipo + pessoas | Motor de cotação calcula e envia mensagem formatada |
| `[CONFIRMAR: params]` | Hóspede confirma interesse em reservar | Notifica equipe no WhatsApp com detalhes |
| `[ESCALAR: motivo]` | Situação fora do escopo ou pedido de humano | Notifica equipe + armazena contexto para relay |
| `[NOME: nome]` | Luna captura o nome do hóspede | Salva no perfil do cliente no Google Sheets |

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `services/whatsapp/webhook.js` | Entrada HTTP, roteamento de mensagens, orquestração |
| `services/luna/system-prompt.js` | Identidade, tom, regras e fluxo de atendimento |
| `services/quotation/engine.js` | Motor de cálculo de cotações por temporada |
| `database/sheets.js` | Histórico, Leads e Clientes no Google Sheets |
| `api/index.js` | Entry point Vercel (thin wrapper) |

## Dados Persistidos (Google Sheets)

- **Histórico:** todas as mensagens (user + assistant) por telefone
- **Leads:** eventos COTAR, CONFIRMAR, ESCALAR com parâmetros
- **Clientes:** perfil por telefone (nome, primeira e última conversa)
