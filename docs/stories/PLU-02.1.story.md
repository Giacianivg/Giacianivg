# PLU-02.1 — Campanha Meta Ads Pascoa 2026

**Epic:** EPIC-PLU-02 Motor de Marketing Digital (Meta Ads + Google)
**DEC:** DEC-003 — PASCOA_SPRINT (Aprovado 2026-03-10)
**Status:** Ready
**Points:** 3
**Priority:** Critica
**Prazo:** Ativar ate 2026-03-13 (15 dias para Pascoa)
**Created:** 2026-03-10
**Author:** Orion (@aios-master) via CMO Agent

---

## Description

Pascoa 2026 (28/mar–06/abr) a 15 dias. Score de aquisicao atual: 28/100. Zero trafego pago ativo.

DEC-003 aprovou a execucao imediata de campanha Meta Ads com dois publicos distintos (casais e familias), budget total R$300, com foco em gerar reservas diretamente via WhatsApp (bot Luna).

Esta story entrega o brief completo de campanha: copies prontos para publicar, configuracao no Meta Business e KPIs de acompanhamento.

**Responsavel de execucao:** Vitor (configura no Meta Business Manager)
**Apoio:** CMO Agent (copies e estrategia)
**Sem codigo necessario** — execucao 100% no Meta Business.

---

## Acceptance Criteria

### AC-1: Copy Publico A — Casais
**Given** o gestor acessa Meta Ads Manager
**When** configura o Ad Set "Casais Pascoa"
**Then** utiliza o copy abaixo com criativo romantico

**Copy Stories (vertical 9:16):**
```
Que tal uma Escapada Romantica de Pascoa?

Pousada Luz da Lua — Socorro, SP
Natureza, silencio e muito cafe da manha.

Pacote Especial Pascoa:
2 noites + cafe incluso
Reserve agora pelo WhatsApp
e ganhe 10% de desconto.

Vagas limitadas para Pascoa.
```

**Copy Feed (quadrado 1:1):**
```
Pascoa diferente comeca aqui.

Escapa com quem voce ama para a Serra da Mantiqueira.
Pousada aconchegante, cafe da manha farto, natureza de verdade.

Pacote Escapada Romantica:
2 noites a partir de R$ 810*
(*com 10% off via WhatsApp)

Clique e reserve. Vagas esgotando.
```

**Headline:** Escapada Romantica de Pascoa — Pousada Luz da Lua
**Call to Action:** Enviar Mensagem
**Destino:** Link wa.me do bot Luna

---

### AC-2: Copy Publico B — Familias
**Given** o gestor acessa Meta Ads Manager
**When** configura o Ad Set "Familias Pascoa"
**Then** utiliza o copy abaixo com criativo familiar

**Copy Stories (vertical 9:16):**
```
Pascoa na montanha com a familia?

Pousada Luz da Lua — Socorro, SP
Criancas adoram. Pais tambem.

Cafe da manha incluso todos os dias.
Natureza, trilhas e muito descanso.

Ultimas vagas para Pascoa!
Fale agora pelo WhatsApp.
```

**Copy Feed (quadrado 1:1):**
```
Faca Pascoa virar uma lembranca inesquecivel.

Socorro, SP — a 2h de SP e Campinas.
Pousada familiar, cafe da manha caprichado,
natureza para as criancas explorarem.

Diarias a partir de R$ 300/noite.
Cafe incluso. Reserva pelo WhatsApp.

Ultimas vagas. Nao deixa para amanha.
```

**Headline:** Pascoa na Pousada para toda a Familia
**Call to Action:** Enviar Mensagem
**Destino:** Link wa.me do bot Luna

---

### AC-3: Configuracao Meta Business Manager
**Given** o gestor acessa Meta Ads Manager
**When** cria a campanha
**Then** configura exatamente como abaixo:

**Campanha:**
- Nome: `Pascoa 2026 — Luz da Lua`
- Objetivo: `Mensagens` (gera conversa no WhatsApp)
- Budget da campanha: R$ 300 total (nao diario)
- Periodo: Data de inicio hoje → 06/abr/2026

**Ad Set A — Casais:**
- Nome: `Casais Romanticos — 150km`
- Publico: Idade 25-45 | Todos os generos
- Localizacao: 150km de Socorro, SP
- Interesses: Viagem romantica, Pousadas, Natureza, Casais, Lua de mel, Turismo rural
- Dispositivos: Mobile only (WhatsApp)
- Budget: 60% do total (R$ 180)
- Posicionamentos: Stories + Feed (Instagram e Facebook)

**Ad Set B — Familias:**
- Nome: `Familias — 200km`
- Publico: Idade 28-50 | Todos os generos
- Localizacao: 200km de Socorro, SP
- Interesses: Viagem em familia, Pascoa, Natureza, Filhos, Feriado, Turismo rural
- Dispositivos: Mobile only
- Budget: 40% do total (R$ 120)
- Posicionamentos: Stories + Feed (Instagram e Facebook)

---

### AC-4: Sugestao de Criativos (imagens/video)
**Given** o gestor precisa dos criativos visuais
**When** seleciona fotos para os anuncios
**Then** prioriza nesta ordem:

**Publico A — Casais (prioridade):**
1. Foto do quarto com cama arrumada, luz natural, atmosfera romantica
2. Foto da varanda/area externa com casal (ou sem pessoas — deixa imaginar)
3. Foto do cafe da manha bem montado
4. Video curto (15s): quarto → natureza → cafe → texto "Reserve agora"

**Publico B — Familias:**
1. Foto area verde/jardim da pousada (criancas adoram)
2. Foto cafe da manha com mesa farta
3. Foto do ambiente externo/piscina (se houver) ou trilha
4. Sem fotos de quartos vazios — mostrar experiencia

**Dica de producao:**
- Fotos no celular com boa luz natural ja funcionam
- Evitar texto demais na imagem (Meta penaliza)
- Formato Stories: 1080x1920px | Feed: 1080x1080px

---

### AC-5: Metricas de Acompanhamento
**Given** a campanha esta ativa
**When** o gestor monitora os resultados diariamente
**Then** acompanha estas metricas no Meta Ads Manager:

| Metrica | Target | Alerta |
|---------|--------|--------|
| CPM (custo por 1000 impressoes) | < R$ 15 | > R$ 25 |
| CTR (taxa de clique) | > 1,5% | < 0,8% |
| Custo por Conversa iniciada | < R$ 30 | > R$ 60 |
| Conversas iniciadas | 10+ | < 5 |
| Reservas geradas | 2+ | 0 em 7d |
| CAC (custo por reserva) | < R$ 150 | > R$ 300 |

**Revisao obrigatoria:** Dia 3 apos ativar — pausar Ad Set com CPM > R$25 ou CTR < 0.5%.

---

## Scope

### IN
- Copy completo dos 2 anuncios (Stories + Feed)
- Sugestao de criativos por publico
- Configuracao detalhada no Meta Business Manager
- Metricas de sucesso e alertas de performance
- Script de atendimento Luna ja ativo (bot responde automaticamente)

### OUT
- Criacao dos criativos (responsabilidade de Vitor / equipe)
- Configuracao do pixel Meta (nao necessario para objetivo Mensagens)
- Google Ads (fora do escopo desta story — DEC futuro)
- Alteracoes no bot Luna (coberto pelo DEC-004 / PLU-DEC004-01)

---

## Technical Notes

### Link WhatsApp (CTA dos anuncios)
Usar link direto para o numero do bot:
```
https://wa.me/55XXXXXXXXXXX?text=Ola%2C+vim+pelo+anuncio+de+Pascoa!
```
Substituir `XXXXXXXXXXX` pelo numero do chip do bot Luna.

A mensagem pre-preenchida ("Vim pelo anuncio de Pascoa!") ajuda Luna a identificar a origem do lead e personalizar a abordagem.

### Timing critico
- Pascoa: 28/mar–06/abr/2026
- Hoje: 10/mar/2026
- Janela: 15 dias — algoritmo Meta precisa de 3-5 dias para aprendizado
- **Ativar ate: 13/mar/2026 no maximo**

---

## Dependencies

- DEC-003 aprovado (2026-03-10) — base estrategica
- Numero do bot Luna ativo (chip dedicado)
- Fotos/criativos disponiveis (Vitor providencia)
- DEC-004 / PLU-DEC004-01 — script Pascoa na Luna (paralelo, nao blocante)

---

## Risks

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Criativos nao prontos ate 13/mar | Alto | Usar fotos do celular — qualidade boa o suficiente |
| Algoritmo Meta em fase de aprendizado | Medio | Aceitar CPL alto nos primeiros 3 dias, so pausar apos day 3 |
| Luna sem script Pascoa na virada | Baixo | Luna ja cota normalmente — script e diferencial, nao bloqueante |
| Budget esgota sem conversao | Medio | Monitorar dia 3 — redistribuir para Ad Set de melhor performance |

---

## Definition of Done

- [ ] Campanha criada no Meta Business Manager
- [ ] Ad Set A (Casais) configurado e ativo
- [ ] Ad Set B (Familias) configurado e ativo
- [ ] Criativos aprovados pelo Meta (sem rejeicao de policy)
- [ ] Link WhatsApp testado (abre bot Luna)
- [ ] Primeiro lead chegou via anuncio
- [ ] Dashboard Meta mostrando impressoes > 0

---

## File List

Sem arquivos de codigo. Execucao no Meta Business Manager.

Documentos gerados nesta story:
- `docs/stories/PLU-02.1.story.md` (este arquivo)

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-10 | 1.0 | Story criada — brief completo Pascoa | Orion (@aios-master) |
