# 📱 Guia de Acesso ao CRM da Pousada — Versão Criança de 8 Anos

Oi! 👋 Você quer aprender como usar o sistema da pousada? É super fácil! Vamos começar?

---

## 📖 Índice (Acha rápido o que quer)

1. [O que é o CRM?](#o-que-é-o-crm)
2. [Como Entrar](#como-entrar)
3. [Tela Principal (Dashboard)](#tela-principal)
4. [Usar o WhatsApp do Bot](#whatsapp-do-bot)
5. [Ver Histórico de Conversas](#histórico)
6. [Verificar Reservas](#reservas)
7. [Ajuda Rápida](#ajuda-rápida)

---

## 🤔 O que é o CRM?

Imagina um **caderninho mágico** onde:
- 📞 Todas as mensagens dos clientes chegam
- 💬 O bot (Luna) responde automaticamente
- 📝 Fica tudo registrado para você consultar depois
- 💰 Mostra quanto cada cliente vai gastar

É basicamente um **gerente de conversas automático** que trabalha 24 horas por dia! 🤖

---

## 🌐 Como Entrar

### Passo 1️⃣: Abrir o navegador

Pensa em um navegador como um **quadro mágico** que te mostra páginas da internet.

Clique em um desses ícones:

```
🔵 Chrome (redondo azul)
🔴 Firefox (laranja/vermelho)
🟢 Safari (maçã)
🔵 Edge (azul)
```

### Passo 2️⃣: Digitar o endereço

Na barra de endereço no topo (que parece um retângulo com texto), apague o que tiver lá e escreva:

```
https://meu-projeto-XXXXXX.vercel.app
```

> ⚠️ **Nota importante:** Alguém da equipe vai te passar o número secreto (XXXXXX) quando o sistema ficar pronto. Hoje ainda não tem!

### Passo 3️⃣: Pressionar Enter

Pronto! A página vai carregar em alguns segundos. Você vai ver:

```
┌─────────────────────────────┐
│    POUSADA LUZ DA LUA       │
│                             │
│    Bem-vindo ao CRM! 🎉     │
│                             │
│    Status: Conectado ✅      │
│                             │
│    Clientes Online: 3        │
│    Reservas Hoje: 1          │
└─────────────────────────────┘
```

---

## 📊 Tela Principal (Dashboard)

Quando você entra, vê um **painel de controle** com várias caixinhas:

### Layout da Tela:

```
┌──────────────────────────────────────────────────────┐
│  🏨 POUSADA LUZ DA LUA            [Olá, João!] 👤    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────┐  ┌────────────────┐             │
│  │ 💬 Mensagens   │  │ 💰 Receita      │             │
│  │ Novas: 5       │  │ Hoje: R$ 1.200  │             │
│  └────────────────┘  └────────────────┘             │
│                                                      │
│  ┌────────────────┐  ┌────────────────┐             │
│  │ 🛏️ Quartos     │  │ 📅 Calendário  │             │
│  │ Ocupados: 8    │  │ Julho cheio!   │             │
│  └────────────────┘  └────────────────┘             │
│                                                      │
│  ┌────────────────────────────────────────┐         │
│  │ 📋 ÚLTIMAS CONVERSAS                   │         │
│  │                                        │         │
│  │ Maria: "Qual preço ALA_A?"    10:30am │         │
│  │ João: "Disponível 15-18 jul?" 9:45am  │         │
│  │ Ana: "Aceita pets?"            9:20am  │         │
│  └────────────────────────────────────────┘         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### O que significam as caixinhas? 🎁

| Caixa | O que é | Exemplo |
|-------|---------|---------|
| 💬 Mensagens | Quantas mensagens novas chegaram | "5 novos clientes conversando" |
| 💰 Receita | Quanto dinheiro entrou hoje | "R$ 1.200 já reservado" |
| 🛏️ Quartos | Quantos quartos estão ocupados | "8 de 10 cheios" |
| 📅 Calendário | Quando está cheio ou vazio | "Junho vazio, Julho lotado" |

---

## 📱 Como Funciona o WhatsApp do Bot (Luna)

### A Mágica Acontece Aqui ✨

Quando um cliente envia mensagem **no WhatsApp da pousada**, é o que acontece:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  1️⃣  Cliente envia: "Oi, qual é o preço?"         │
│      📞 via WhatsApp para (19) 9XXXX-XXXX          │
│                                                     │
│  2️⃣  Luna (bot) recebe INSTANTANEAMENTE ⚡        │
│      Lê a mensagem em 0.5 segundos                 │
│                                                     │
│  3️⃣  Claude (IA) pensa na resposta                │
│      "O cliente quer saber preço... vou buscar"   │
│                                                     │
│  4️⃣  Luna responde SOZINHA 🤖                     │
│      "Oi! Adoraríamos! ALA_A custa R$ 300/noite" │
│      Resposta em ~2 segundos                       │
│                                                     │
│  5️⃣  Tudo fica registrado no CRM 📝               │
│      Você vê a conversa completa depois            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Quando Luna Avisa a Equipe 🚨

Luna NÃO consegue responder em 2 casos:

#### Caso 1: Cliente quer AGENDAR [CONFIRMAR]
```
Cliente: "Quero 2 quartos, 15-18 de julho, para 6 pessoas"

Luna pensa: "Vou reservar... preciso que a equipe confirme!"

Luna envia:
"Perfeito! Vou reservar para você.
Por favor, aguarde a confirmação da equipe. ⏳"

EQUIPE VIRA E SAI:
📲 Mensagem no WhatsApp (19) 99840-0306:
   "Nova reserva: Maria Silva, 2 quartos, 15-18 jul, 6 ppl"
   Você confirma ou não confirmando
```

#### Caso 2: Cliente Pede Algo que Luna Não Sabe [ESCALAR]
```
Cliente: "Vocês aceitam grupo de 40 pessoas?"

Luna pensa: "Grupo grande! Preciso chamar o gerente."

Luna responde:
"Adoramos grupos! Vou chamar nossa equipe.
Eles te contactam em 5 minutos! 📞"

EQUIPE RECEBE:
📲 "Grupo de 40 ppl quer saber preço"
   A equipe fala direto com o cliente
```

---

## 📖 Histórico de Conversas (Ver Tudo que Aconteceu)

### Como Entrar?

Na tela principal, clique em:

```
┌─────────────────────┐
│ 📋 HISTÓRICO       │  ← Clica aqui
└─────────────────────┘
```

### O que você vai ver:

```
┌──────────────────────────────────────────────────────┐
│  HISTÓRICO DE CONVERSAS                             │
│                                                      │
│  🔍 Pesquisar: [________________] 🔎                │
│     (Se quer achar conversa de João, escreve "João")│
│                                                      │
│  📱 Maria Silva                                      │
│     Mensagens: 12      Última: Hoje 3:15pm ✅       │
│     Status: ❌ Não agendou (só perguntou preço)     │
│                                                      │
│  📱 João Santos                                      │
│     Mensagens: 8       Última: Ontem 10:30am        │
│     Status: ✅ RESERVADO (15-18 julho)              │
│     Valor: R$ 900                                   │
│                                                      │
│  📱 Ana Costa                                        │
│     Mensagens: 3       Última: 2 dias atrás         │
│     Status: ⏳ Aguardando resposta                   │
│     Pergunta: Aceita pets?                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### O que fazer no Histórico:

| Ação | Como Fazer |
|------|-----------|
| Ver conversa completa | Clica no nome |
| Pesquisar um cliente | Escreve o nome na caixa de pesquisa |
| Ver só reservas | Clica em "Status: ✅ Reservado" |
| Ver só dúvidas | Clica em "Status: ❓ Dúvida" |

---

## 🛏️ Reservas (Olhar as Datas e Quartos)

### Como Entrar?

```
┌─────────────────────┐
│ 🗓️ RESERVAS        │  ← Clica aqui
└─────────────────────┘
```

### Calendário Visual:

```
┌────────────────────────────────────────────────────────┐
│                    JULHO 2026                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Dom  Seg  Ter  Qua  Qui  Sex  Sab                    │
│                          1   2   3   4                │
│   5   6   7   8   9   10  11                          │
│  12  13  14 🟦15 🟦16 🟦17  18  19  ← João: 15-17    │
│  20  21  22  23  24  25  26                          │
│  27  28  29  30  31                                  │
│                                                        │
│  🟦 = Ocupado    ⬜ = Disponível    🟧 = Parcial     │
│                                                        │
│  LEGENDA DE QUARTOS:                                 │
│  ALA_A (3 pax): 🔴  ALA_B (5 pax): 🟠               │
│  ALA_C (8 pax): 🟡                                   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Informações de Cada Quarto:

Se clicar em um dia que tá ocupado (🟦), vê:

```
┌────────────────────────┐
│  JULHO 15-17 (João)    │
├────────────────────────┤
│ Cliente: João Santos   │
│ Tel: (19) 99XXX-XXXX   │
│                        │
│ ALA_A (3 pessoas):     │
│ ✅ PAGO (R$ 900)       │
│                        │
│ Check-in: 15/07 14h    │
│ Check-out: 17/07 11h   │
│                        │
│ [Enviar mensagem]      │
│ [Modificar]            │
│ [Cancelar]             │
└────────────────────────┘
```

---

## 💬 Conversa Completa (Um Exemplo Real)

### Como Aparecer na Tela:

```
┌────────────────────────────────────────────────────────┐
│  CONVERSA COM MARIA SILVA                             │
│  13 mensagens | Última: Hoje 3:15pm                   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  MAR 11:30 AM                                         │
│  Maria:                                               │
│  "Oi! Tudo bem? Vocês têm disponibilidade para       │
│   15 a 18 de julho? Somos 3 pessoas."                │
│                                                        │
│  11:32 AM                                             │
│  Luna (Bot):                                          │
│  "Oi Maria! 👋 Tudo bem sim! Deixa eu ver...         │
│   Você quer ALA_A, ALA_B ou ALA_C?                   │
│   Quantas pessoas vão?"                              │
│                                                        │
│  11:35 AM                                             │
│  Maria:                                               │
│  "3 pessoas. A mais baratinha mesmo 😅"               │
│                                                        │
│  11:36 AM                                             │
│  Luna (Bot):                                          │
│  "Perfeito! ALA_A é apertada para 3, mas dá! 📍      │
│   15-18 julho (3 noites):                             │
│   → R$ 300/noite × 3 = R$ 900 total                 │
│                                                        │
│   Quer confirmar? 😊"                                 │
│                                                        │
│  11:37 AM                                             │
│  Maria:                                               │
│  "Achei caro. Tem desconto?"                          │
│                                                        │
│  11:38 AM                                             │
│  Luna (Bot):                                          │
│  "Infelizmente não! Julho é época cara.               │
│   Mas 3 noites é bom custo-benefício!                │
│   Se quiser outras datas, vejo desconto.             │
│   Quer ir em frente?"                                 │
│                                                        │
│  3:15 PM (SEM RESPOSTA)                              │
│  Status: ⏳ AGUARDANDO CLIENTE                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 🚨 Situações Especiais

### Quando o Cliente Quer Confirmar Tudo

```
Cliente: "Topei! Quer meu nome completo:
         Maria Silva Oliveira
         CPF: 123.456.789-00
         Chegada: 15/07 14h
         Saída: 18/07 11h"

Luna responde:
"Ótimo! Vou anotar tudo! 📝

Sua reserva:
✅ Cliente: Maria Silva Oliveira
✅ Quarto: ALA_A (3 pessoas)
✅ Datas: 15-18 julho
✅ Total: R$ 900
✅ Status: CONFIRMADA 🎉

Aguardamos você! Abraços! 🤗"

SISTEMA FAZ:
→ Grava tudo no banco de dados
→ Envia confirmação por email
→ Notifica a equipe (19) 99840-0306
→ Coloca no calendário
```

### Quando Alguém Cancela

```
Cliente: "Oi, preciso cancelar minha reserva 😭"

Luna responde:
"Que pena! 😢 Entendo.

Deixa eu chamar a equipe para processar isso.
Você vai receber uma ligação em 30 minutos.

Obrigada por considerar a gente! 💙"

EQUIPE RECEBE:
📞 "CANCELAMENTO: João Santos (15-17 jul)
    Vai rolar reembolso?"
```

---

## ❓ Perguntas que Você Pode Fazer

### Para Luna no WhatsApp

Luna consegue responder SOZINHA essas coisas:

```
✅ "Qual preço de ALA_A?"
✅ "Vocês aceitam pets?"
✅ "Qual é o horário de check-in?"
✅ "Qual quartos tenho disponível?"
✅ "Vocês fazem desconto para grupos?"
✅ "Qual é o endereço?"
✅ "Qual o número de telefone?"
✅ "Qual é a forma de pagamento?"
✅ "Qual é a política de cancelamento?"
```

### Para a Equipe Humana (quando Luna não sabe)

```
❌ "Vocês fazem buffet para 50 pessoas?"
   → Luna avisa a equipe

❌ "Alugam utensílios para festas?"
   → Luna escala para a equipe

❌ "Conhecem pedreiro confiável?"
   → Luna escala para a equipe

❌ Reclamações / problemas / brigas
   → Luna escala imediatamente
```

---

## 🎯 Rotina Diária da Equipe (Como Você Usa)

### ☀️ Manhã (8:00 AM)

1. Abre o CRM
2. Clica em "Reservas" e vê quem chega hoje
3. Prepara os quartos
4. Verifica "Mensagens Novas" - responde se Luna pedir ajuda
5. Toma café ☕

### 🌤️ Meio do Dia (12:00 PM)

1. Atualiza status de check-ins
2. Verifica histórico de novas conversas
3. Responde clientes com dúvidas
4. Almoço com a turma 🍽️

### 🌅 Tarde (15:00 PM)

1. Vê quantas mensagens novas chegaram
2. Responde escalações (Luna vai avising)
3. Prepara confirmações de reserva
4. Lê feedback de clientes

### 🌙 Noite (20:00 PM)

1. Faz um resumo do dia:
   - Quantas reservas entraram?
   - Quanto de receita?
   - Algum problema?
2. Pronto! Luna cuida do resto while you sleep 😴

---

## 🆘 Ajuda Rápida (Se Tiver Dúvida)

### "Não tô achando o botão de XYZ"

```
1️⃣ Tenta clicar nas caixinhas principais
2️⃣ Tenta escrever na caixa de pesquisa
3️⃣ Chama a turma: "Ei, como faz pra ver as conversas?"
4️⃣ Se ninguém sabe, chama o desenvolvedor 📞
```

### "A Luna não respondeu um cliente"

```
Provavelmente é porque:
1️⃣ Interrobang (quando Luna não entende):
   → Avisa na equipe para responder

2️⃣ Pergunta de negócio (tipo grupo grande):
   → Luna pede ajuda da equipe
   → Você vai receber aviso no WhatsApp

3️⃣ Erro técnico (raríssimo):
   → Tira print e manda pro desenvolvedor
```

### "O CRM tá lento"

```
Tenta:
1️⃣ F5 (atualizar a página)
2️⃣ Fecha e abre de novo
3️⃣ Espera 30 segundos
4️⃣ Reinicia o navegador
5️⃣ Se não funcionar = chama desenvolvedor 📞
```

### "Perdi uma conversa"

```
Não se preocupa! Está tudo salvo!
1️⃣ Clica em "HISTÓRICO"
2️⃣ Escreve o nome do cliente
3️⃣ Acha a conversa completa
4️⃣ Problema resolvido! 🎉
```

---

## 🎓 Resumão (Para Aprender Rápido)

| Funcionalidade | O que faz | Onde fica |
|---|---|---|
| **Dashboard** | Mostra resumo do dia | Tela principal |
| **Histórico** | Ver conversas antigas | Menu "📋 Histórico" |
| **Reservas** | Ver calendário e datas | Menu "🗓️ Reservas" |
| **Mensagens** | Responder clientes | Menu "💬 Mensagens" |
| **Relatórios** | Ver quanto ganhou | Menu "📊 Relatórios" |

---

## 📞 Contato para Ajuda

Se tiver dúvida que ninguém consegue resolver:

```
Desenvolvedor (Técnico):
📧 Email: dev@pousadalizdalua.com.br
📞 WhatsApp: (19) 99XXX-XXXX
⏰ Responde em 1-2 horas max
```

---

## 🎉 Parabéns!

Agora você já sabe:
- ✅ Como entrar no CRM
- ✅ Como ver as reservas
- ✅ Como ler as conversas
- ✅ Como a Luna ajuda vocês
- ✅ O que fazer quando tiver dúvida

**Você tá pronto(a) para usar! Boa sorte! 🚀**

---

*Feito com ❤️ para a equipe da Pousada Luz da Lua*
*Versão 1.0 — Março 2026*
