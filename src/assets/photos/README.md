# Fotos da Pousada — Uso pelo Bot Luna

Estas fotos são enviadas pelo bot via WhatsApp para aquecer leads e contornar objeções.
As imagens precisam estar em **URLs públicas HTTPS** para o WhatsApp Cloud API conseguir enviá-las.

## Como hospedar as fotos

Opção mais simples: fazer upload na pasta `public/` do deploy no Vercel.
Depois de fazer o deploy, as URLs ficam no formato:
`https://seu-app.vercel.app/photos/nome-da-foto.jpg`

---

## Fotos necessárias — Checklist de produção

### PRIORIDADE 1 — Fotos para grupos (aquecimento de lead)

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `pousada-fachada.jpg` | Fachada da pousada, vista externa com jardim | ⏳ pendente |
| `pousada-piscina.jpg` | Piscina externa — preferencialmente com luz natural | ⏳ pendente |
| `pousada-cafe-manha.jpg` | Mesa de café da manhã farta e bem montada | ⏳ pendente |
| `pousada-area-comum.jpg` | Área de convivência/varanda com grupo | ⏳ pendente |
| `regiao-circuito-aguas.jpg` | Vista da natureza de Socorro-SP (cachoeira, trilha ou paisagem) | ⏳ pendente |
| `pousada-grupo.jpg` | Foto de grupo de pessoas felizes na pousada (se disponível) | ⏳ pendente |

### PRIORIDADE 2 — Fotos para casais e famílias (cotação individual)

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `quarto-ala-a.jpg` | Quarto Ala A — cama casal bem arrumada, iluminação aconchegante | ⏳ pendente |
| `quarto-ala-b.jpg` | Quarto Ala B — configuração família visível | ⏳ pendente |

---

## URLs para uso no Make.com e system prompt

Preencher após o deploy no Vercel:

```
FOTO_POUSADA_FACHADA=https://seu-app.vercel.app/photos/pousada-fachada.jpg
FOTO_POUSADA_PISCINA=https://seu-app.vercel.app/photos/pousada-piscina.jpg
FOTO_CAFE_MANHA=https://seu-app.vercel.app/photos/pousada-cafe-manha.jpg
FOTO_AREA_COMUM=https://seu-app.vercel.app/photos/pousada-area-comum.jpg
FOTO_REGIAO=https://seu-app.vercel.app/photos/regiao-circuito-aguas.jpg
FOTO_QUARTO_ALA_A=https://seu-app.vercel.app/photos/quarto-ala-a.jpg
FOTO_QUARTO_ALA_B=https://seu-app.vercel.app/photos/quarto-ala-b.jpg
```

Adicionar estas variáveis no Make.com Team Variables após o deploy.

---

## Quando o bot envia cada foto

| Situação | Foto enviada |
|----------|-------------|
| Grupo — Passo 3 (apresentação) | `pousada-fachada.jpg` + `pousada-piscina.jpg` |
| Grupo — Objeção 4 ("pesquisando outras") | `pousada-cafe-manha.jpg` + `regiao-circuito-aguas.jpg` |
| Grupo — Objeção 5 ("preciso confirmar com grupo") | `pousada-area-comum.jpg` (para compartilhar no grupo deles) |
| Individual — após cotação (opcional) | `quarto-ala-a.jpg` ou `quarto-ala-b.jpg` conforme tipo |

---

## Dicas de fotografia para máxima conversão

- **Horário:** luz natural da manhã (7h-9h) ou tarde (16h-18h) — evitar meio-dia
- **Piscina:** fotografar limpa, com cadeiras organizadas, sem pessoas atrapalhando o fundo
- **Café da manhã:** mesa cheia e colorida, frutas, pães, etc. — é um dos maiores diferenciais
- **Quartos:** cama arrumada com lençóis brancos, janela aberta com luz natural
- **Grupo:** pessoas sorrindo, ambiente descontraído — transmite experiência, não só estrutura
- **Formato:** JPG, mínimo 1200×800px, máximo 5MB por foto (limite do WhatsApp)
