# Relatório de Diagnóstico — Plataforma de Automação
## Pousada Luz da Lua

**Data:** 24 de fevereiro de 2026
**Elaborado por:** Equipe técnica de desenvolvimento
**Destinatário:** Gestão da Pousada Luz da Lua
**Referência técnica:** `docs/prd/technical-debt-assessment.md`

---

## Resumo para Leitura Rápida

> **Situação:** O sistema de atendimento automático via WhatsApp (Luna) está **pronto em código**, mas ainda não pode funcionar porque depende de 4 ações externas que só você pode fazer — nenhuma delas envolve programação.
>
> **Prazo estimado para lançamento:** 3 semanas a partir de hoje, se as ações da Semana 1 forem concluídas esta semana.
>
> **O que muda quando lançar:** Atendimento 24/7 sem custo de funcionário, cotações automáticas em minutos, aumento esperado de conversão de ~10% para >25%.

---

## 1. O Que Já Está Pronto

O trabalho técnico principal foi concluído. Tudo abaixo existe e foi testado:

| O que está pronto | Resultado dos testes |
|-------------------|---------------------|
| Luna responde mensagens no WhatsApp com tom acolhedor | 32/32 cenários aprovados |
| Luna responde sobre Wi-Fi, piscina, pets, horários, localização | Sem erros de informação |
| Luna conduz o hóspede pelas perguntas de cotação (datas → pessoas → tipo de quarto) | Fluxo validado |
| Luna gera cotação com valores corretos de todas as temporadas | 20/20 cenários aprovados |
| Hóspede responde CONFIRMAR → equipe recebe notificação | Documentado e testado |
| Follow-up automático para quem não respondeu a cotação | Configurado |
| Sistema registra todos os contatos no CRM (Airtable) | Integração pronta |

**Custo mensal estimado do sistema em operação:** ~R$170/mês (Make.com + Claude + Airtable)
*(para comparação: um atendente em tempo parcial custa R$1.500-2.500/mês)*

---

## 2. O Que Ainda Não Funciona — e Por Quê

Existem **4 bloqueadores que dependem exclusivamente de você** (gestão). Enquanto qualquer um deles estiver em aberto, o sistema simplesmente não opera:

### Bloqueador 1 — Migrar o número de WhatsApp
**Situação:** O número (19) 99840-0306 ainda funciona como WhatsApp pessoal/convencional. Para a automação funcionar, ele precisa ser vinculado à API do WhatsApp Business (Meta).

**O que acontece se não fizer:** Luna não consegue enviar nem receber nenhuma mensagem. O sistema existe, mas está "desligado".

**Como fazer:** Processo feito diretamente no painel da Meta. Requer criar um Gerenciador de Negócios (ver Bloqueador 4) e pode causar ~2h de indisponibilidade do número durante a migração. Recomendar fazer num domingo de manhã, quando o movimento é baixo.

**Tempo:** 2-4 horas (uma vez só).

---

### Bloqueador 2 — Criar a base de dados no Airtable
**Situação:** O "arquivo de hóspedes digital" ainda não existe. Sem ele, Luna não tem onde guardar os contatos, consultar disponibilidade de quartos nem buscar preços para fazer cotações.

**O que acontece se não fizer:** Luna não consegue fazer cotações nem guardar histórico de conversa.

**Como fazer:** Acessar o Airtable, criar uma base chamada "Pousada Luz da Lua — CRM" seguindo o guia em `docs/data/SCHEMA.md`. A equipe técnica preparou o guia passo a passo com todos os campos necessários.

**Atenção:** Criar já com todos os campos indicados no guia — adicionar depois é muito mais trabalhoso do que fazer certo da primeira vez.

**Custo:** Plano "Team" do Airtable — US$20/mês (~R$115/mês). O plano gratuito não é suficiente.

**Tempo:** 2-3 horas (uma vez só, seguindo o guia).

---

### Bloqueador 3 — Registrar o endereço do sistema no Meta
**Situação:** O sistema de automação (hospedado na internet) tem um "endereço" que precisa ser cadastrado no painel da Meta para que as mensagens do WhatsApp sejam enviadas para ele.

**O que acontece se não fizer:** As mensagens chegam ao WhatsApp, mas ninguém "recebe" para processar. Luna nunca vê as mensagens.

**Como fazer:** Ação de 30 minutos no painel da Meta após o deploy técnico. A equipe de desenvolvimento faz esta parte.

**Tempo:** 30 minutos (feito pela equipe técnica, não pela gestão).

---

### Bloqueador 4 — Criar o Gerenciador de Negócios Meta
**Situação:** Para usar a API oficial do WhatsApp, a Meta exige que a empresa tenha um "Meta Business Manager" — uma conta comercial verificada com o CNPJ da pousada.
**O que acontece se não fizer:** Não é possível migrar o número (Bloqueador 1) nem registrar o sistema (Bloqueador 3).

**Como fazer:** Acessar business.facebook.com e criar uma conta com os dados da pousada e CNPJ. O CNPJ já foi confirmado como disponível.

**Tempo:** 1-2 horas para criação + alguns dias para verificação pela Meta.

> ⚠️ Este é o bloqueador que deve ser iniciado PRIMEIRO, pois a aprovação pela Meta pode levar de 2 a 7 dias úteis.

---

## 3. Riscos Que Precisam de Atenção Antes do Lançamento

Além dos 4 bloqueadores, existem pontos que a equipe técnica precisa resolver antes de o sistema atender hóspedes reais. Traduzindo em linguagem de negócio:

### Risco Alto: Hóspede confirma reserva e não recebe resposta clara

**O problema:** Quando o hóspede responde "CONFIRMAR", Luna confirma o recebimento, mas diz apenas "Em breve nossa equipe entrará em contato" — sem dizer quando. Hóspede motivado que não recebe confirmação em minutos pode ir direto ao Booking.com ou para outra pousada.

**A solução:** Atualizar a mensagem para ser específica: "Nossa recepção (disponível das 12h às 22h) confirmará em até 2 horas e enviará as instruções de pagamento." A mensagem do sistema já foi atualizada; a equipe técnica precisa implementar a lógica no Make.com.

**Esforço:** 1 hora da equipe técnica.

---

### Risco Alto: Luna diz "um momento" para chamar a equipe, mesmo às 23h

**O problema:** Quando Luna não consegue responder algo e precisa escalar para um atendente humano, ela diz "Vou chamar nossa equipe! Um momento 🌙". Se for meia-noite, o hóspede fica esperando e fica frustrado.

**A solução:** Adaptar a mensagem conforme o horário: dentro do expediente (12h-22h) diz "responderemos em até 30 minutos"; fora do expediente diz "nossa recepção abre às 12h e entrará em contato assim que possível". A mensagem do sistema já foi atualizada; a equipe técnica implementa a lógica no Make.com.

**Esforço:** 1 hora da equipe técnica.

---

### Risco Médio: Dois hóspedes podem reservar o mesmo quarto na mesma data

**O problema:** Quando uma reserva é confirmada, o sistema precisa "marcar" aquele quarto como ocupado naquele período. Atualmente isso é feito manualmente — se a equipe esquecer ou demorar, outro hóspede pode receber cotação para um quarto já reservado.

**A solução:** Automatizar essa marcação: quando alguém confirmar uma reserva, o sistema atualiza a disponibilidade automaticamente, sem precisar de nenhuma ação manual.

**Esforço:** 2 horas da equipe técnica. **Recomendação: fazer antes de divulgar o número publicamente.**

---

### Risco Médio: Segurança do sistema (verificação técnica)

**O problema:** Existe uma verificação de segurança no código que precisa ser confirmada pela equipe técnica — ela garante que apenas mensagens reais do WhatsApp (enviadas pela Meta) sejam processadas pelo sistema, impedindo que alguém externo "injete" mensagens falsas.

**A solução:** A equipe técnica verifica o código em 1 hora. Se já estiver implementado, zero trabalho adicional. Se não estiver, 1 hora para implementar.

**Esforço:** 1 hora da equipe técnica (verificação).

---

## 4. Informações Operacionais Confirmadas

O discovery confirmou todas as informações que Luna usará para atender os hóspedes. Abaixo o resumo para validação final:

| Informação | Confirmado |
|-----------|-----------|
| Wi-Fi incluso na diária | ✅ Sim, em todas as alas |
| Piscina disponível | ✅ Piscina externa para todos os hóspedes |
| Aceita pets | ✅ Sim — taxa de R$20/dia por animal |
| Cancelamento gratuito | ✅ Até 7 dias antes do check-in |
| Check-in / Check-out | ✅ 14h / 12h |
| Horário da recepção | ✅ 12h às 22h |
| Estacionamento | ⏳ **Ainda não confirmado** — favor informar se há vagas e se é cobrado |

> **Ação necessária:** Confirmar a informação de estacionamento para que Luna possa responder essa pergunta sem precisar escalar para um atendente.

---

## 5. Tabela de Preços Confirmada

| Período | 2 pessoas | 3 pessoas | 4 pessoas | 5 pessoas | Mín. noites |
|---------|-----------|-----------|-----------|-----------|-------------|
| Dias úteis (baixa) | R$300 | R$300 | R$300 | R$300 | 1 noite |
| Fins de semana | R$300 | R$350 | R$350 | R$350 | 2 noites |
| Alta temporada* | R$400 | R$550 | R$700 | R$850 | 2 noites |

*Alta temporada: Carnaval, Semana Santa, Férias de julho, Natal, Réveillon e feriados prolongados.

**Regra para estadias que cruzam temporadas:** Cada noite é cobrada pelo valor da sua temporada. Exemplo: 3 noites em baixa (R$300 × 3 = R$900) + 2 noites em alta (R$400 × 2 = R$800) = R$1.700 total.

**Quartos para grupos (Ala C / até 8 pessoas):** Luna não cotiza esses quartos automaticamente — sempre transfere para a equipe, que negocia o valor diretamente.

---

## 6. Plano de Ação — Quem Faz O Quê

### Esta semana — Gestão da pousada

| Ação | Tempo estimado | Urgência |
|------|---------------|---------|
| ① Criar Meta Business Manager (business.facebook.com) com CNPJ | 1-2h | 🔴 Fazer hoje — aprovação pode demorar até 7 dias |
| ② Criar base Airtable seguindo o guia `docs/data/SCHEMA.md` | 2-3h | Alta |
| ③ Contratar plano "Team" do Airtable (US$20/mês) | 10 min | Alta |
| ④ Confirmar informação de estacionamento para a equipe | 5 min | Média |
| ⑤ Agendar janela de migração do número WhatsApp (ex: domingo manhã) | 5 min | Alta |

### Esta semana — Equipe técnica

| Ação | Tempo estimado |
|------|---------------|
| Verificar segurança do código (QA-01) | 1h |
| Deploy do sistema e registro do endereço no Meta (DT-01) | 1h |
| Configurar senhas e chaves de API no ambiente de produção (DT-08) | 1h |

### Semana 2 — Equipe técnica (após Airtable criado)

| Ação | Impacto |
|------|---------|
| Conectar Make.com ao Airtable, WhatsApp e Claude | Sistema completo começa a funcionar |
| Implementar lógica para evitar duplicidade de hóspedes no CRM | CRM confiável desde o primeiro dia |
| Ajustar mensagem de escalonamento por horário | Experiência correta para hóspede |

### Semana 3 — Equipe técnica (antes de divulgar o número)

| Ação | Impacto |
|------|---------|
| Automatizar marcação de disponibilidade ao confirmar reserva | Elimina risco de overbooking |
| Implementar validação de mínimo de noites na cotação | Cotações sempre dentro das regras |
| Implementar mensagem pós-confirmação com prazo claro | Evita perda de hóspedes motivados |
| Executar 7 testes reais no WhatsApp | Garantia antes do lançamento público |

---

## 7. Investimento e Retorno Esperado

### Custos Mensais do Sistema em Operação

| Serviço | Custo/mês |
|---------|-----------|
| Make.com (orquestrador) | ~R$50 |
| Claude / DeepSeek (IA) | ~R$20-90* |
| Airtable (banco de dados) | ~R$115 |
| **Total estimado** | **~R$185-255/mês** |

*Custo da IA varia conforme volume de conversas. Com roteamento inteligente (DeepSeek para perguntas simples, Claude para cotações), o custo fica próximo de R$20/mês para até 1.000 conversas.

### Impacto Esperado no Negócio

| Métrica | Antes | Após automação |
|---------|-------|---------------|
| Tempo de primeiro atendimento | Horas (dependente de pessoa) | <2 minutos, 24/7 |
| Taxa de conversão lead → reserva | ~10% (estimado) | >25% (meta) |
| Receita mensal | ~R$30k | R$60k (meta MVP) |
| Horas de atendimento humano/mês | Alta | Apenas confirmações e casos complexos |
| Cotações respondidas fora do horário | 0 | 100% |

---

## 8. Uma Ação Pendente Crítica

Antes de divulgar o número publicamente, a gestão precisa ter clareza sobre um processo operacional:

**Após o hóspede responder CONFIRMAR:**
Luna envia uma mensagem confirmando o pedido e informa que a equipe entrará em contato em até 2 horas para orientar o pagamento. A partir daí, **a equipe humana precisa:**

1. Ver a notificação no WhatsApp da equipe
2. Confirmar a disponibilidade manualmente no Airtable
3. Entrar em contato com o hóspede para combinar o pagamento (PIX, cartão, etc.)
4. Atualizar o status para "Reservado" no Airtable

Este processo humano precisa ser definido antes do lançamento: quem é responsável, em que horário, e o que acontece fora do expediente (12h-22h).

---

## 9. Próximos Passos Após o Lançamento do MVP

Uma vez que o sistema estiver funcionando e gerando receita estável, existem melhorias planejadas que aumentarão a eficiência e reduzirão custos:

| Melhoria | Benefício | Quando |
|---------|-----------|--------|
| Roteamento inteligente de IA (perguntas simples vão para um modelo mais barato) | Economia de ~55% no custo de IA | 1ª semana pós-lançamento |
| Backup automático semanal dos dados de hóspedes | Proteção contra perda de dados | 1ª semana pós-lançamento |
| Monitor de disponibilidade do sistema (alerta se cair) | Nenhuma mensagem perdida sem aviso | 1ª semana pós-lançamento |
| CRM de retenção — régua de comunicação com hóspedes anteriores | Aumento da taxa de retorno | EPIC-PLU-04 (próxima fase) |
| Dashboard de analytics — RevPAR, ocupação, canal de origem | Decisões baseadas em dados | EPIC-PLU-05 (próxima fase) |

---

## 10. Resumo das Ações Imediatas

```
HOJE (gestão):
  → Criar Meta Business Manager — não espere, a aprovação demora

ESTA SEMANA (gestão):
  → Criar base Airtable com o guia fornecido
  → Contratar plano Team do Airtable (US$20/mês)
  → Agendar migração do número WhatsApp
  → Confirmar: tem estacionamento? É cobrado?

ESTA SEMANA (equipe técnica):
  → Verificar segurança do código
  → Deploy + registro do sistema no Meta

SEMANAS 2-3 (equipe técnica):
  → Conectar todos os sistemas
  → Implementar melhorias de experiência
  → 7 testes reais antes de divulgar

RESULTADO: Sistema funcionando em ~3 semanas.
```

---

*Relatório elaborado com base no Brownfield Discovery completo (Fases 1-8).*
*Referência técnica completa: `docs/prd/technical-debt-assessment.md`*
