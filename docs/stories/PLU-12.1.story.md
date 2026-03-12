# PLU-12.1 — Vouchers PDF: Geração + API + Página CRM + Luna

**Epic:** EPIC-PLU-12 Vouchers PDF (DEC-016)
**Status:** Done
**Points:** 13
**Priority:** Alta (P1)
**Created:** 2026-03-12
**Author:** Morgan (@pm)

---

## Description

A Pousada Luz da Lua não possui voucher formal de hospedagem. Hóspedes recebem
confirmações informais pelo WhatsApp sem identidade visual e Luna não consegue
entregar comprovante quando solicitado.

Esta story implementa o sistema completo de vouchers PDF:
1. Geração de PDF com identidade visual da pousada (`pdf-lib`)
2. Tabela `vouchers` no Supabase (migration 010)
3. API REST completa com endpoint de download público (token-based)
4. Página CRM `public/vouchers.html` com busca e filtro
5. Luna orientada a fornecer link de download quando hóspede pedir
6. Montagem de `/api/vouchers` em `server.js`

**Fontes de reserva suportadas:** `direct`, `booking`, `expedia`, `whatsapp`

---

## Acceptance Criteria

### AC-1: Voucher PDF gerado com identidade visual
**Given** existe um voucher no banco com dados de reserva completos
**When** GET /api/vouchers/:id/download?token=ABC é chamado
**Then** resposta tem Content-Type: application/pdf
**And** PDF contém: nome do hóspede, tipo de acomodação, datas, número de hóspedes, número do voucher, logo/header "Pousada Luz da Lua", endereço "Socorro-SP"

### AC-2: Endpoint de download público (sem auth)
**Given** voucher tem `download_token` único gerado no POST
**When** GET /api/vouchers/:id/download?token={download_token}
**Then** retorna PDF sem exigir Authorization header
**And** token inválido retorna 403

### AC-3: CRUD de vouchers requer auth
**Given** usuário autenticado no CRM
**When** POST /api/vouchers com { reservation_id, guest_name, room_type, check_in, check_out, guests, source, total_amount }
**Then** voucher criado com status `active` e `download_token` gerado (UUID)
**And** retorna { id, download_token, download_url }

### AC-4: Listar vouchers com filtros
**Given** existem vouchers de múltiplas fontes
**When** GET /api/vouchers?source=booking&status=active&search=Maria
**Then** retorna lista filtrada com paginação (limit/offset)
**And** suporta filtros: source (direct/booking/expedia/whatsapp), status (active/cancelled), search (nome do hóspede)

### AC-5: Página CRM — lista com busca e filtro
**Given** gestor acessa /vouchers.html
**When** página carrega
**Then** exibe tabela com: número, hóspede, acomodação, check-in, check-out, fonte, status, ações
**And** há input de busca por nome
**And** há dropdown de filtro por fonte
**And** botão "Baixar PDF" abre o link de download em nova aba
**And** botão "Novo Voucher" abre modal de criação

### AC-6: Luna fornece link de download
**Given** hóspede com reserva confirmada pede comprovante no WhatsApp
**When** Luna identificar pedido de voucher/comprovante
**Then** Luna responde com o link de download do voucher correspondente
**And** se não houver voucher, Luna orienta o hóspede a aguardar confirmação da equipe

### AC-7: Fonte "booking" e "expedia" exibem badge correto no PDF
**Given** voucher tem source = "booking"
**When** PDF é gerado
**Then** rodapé do PDF indica "Reserva via Booking.com"
**And** source = "expedia" → "Reserva via Expedia"
**And** source = "direct" → "Reserva Direta"
**And** source = "whatsapp" → "Reserva via WhatsApp"

---

## Scope

**IN:**
- Instalar `pdf-lib` como dependência (`npm install pdf-lib`)
- `services/voucher/voucher-generator.js` — geração PDF com pdf-lib
- `database/migrations/010_vouchers.sql` — tabela vouchers
- `routes/vouchers.js` — GET lista, POST criar, PATCH :id, GET :id/download
- Montar `/api/vouchers` em `server.js` (linha após `/api/financial`)
- `public/vouchers.html` — página CRM completa
- Instrução para Luna no `services/luna/system-prompt.js` (seção de sinais existente — append only)

**OUT:**
- QR Code no PDF (requer biblioteca extra — fora do escopo)
- Email automático de voucher (PLU-13 futuro)
- Integração automática com API Booking/Expedia (manual por ora)
- Upload para Supabase Storage (geração on-demand é suficiente)
- Alteração no `services/whatsapp/webhook.js` (Luna usa link, não envia PDF direto)

---

## Technical Notes

### pdf-lib usage pattern
```javascript
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function generateVoucherPDF(voucher) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  // ... desenhar layout
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
```

### Design do PDF (identidade visual)
- Header: fundo verde escuro (#1B4332), texto branco, "POUSADA LUZ DA LUA"
- Subtítulo: "Socorro-SP · Natureza e Aconchego"
- Voucher number em destaque
- Seção hóspede: nome grande
- Tabela de detalhes: acomodação, check-in, check-out, hóspedes, total
- Badge de fonte: Booking.com / Expedia / Reserva Direta / WhatsApp
- Rodapé: "Obrigado por escolher a Pousada Luz da Lua"
- Cores: verde (#1B4332), dourado (#B8860B), texto escuro (#1C1C1E)

### Migration 010
```sql
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  room_type TEXT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL CHECK (source IN ('direct','booking','expedia','whatsapp')),
  total_amount NUMERIC(10,2),
  download_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vouchers_guest_name ON vouchers(guest_name);
CREATE INDEX idx_vouchers_source ON vouchers(source);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_download_token ON vouchers(download_token);
```

### server.js mount (após linha /api/financial)
```javascript
app.use('/api/vouchers', require('./routes/vouchers'));
```

### Luna instruction (append ao system-prompt — seção sinais)
```
Quando hóspede pedir voucher, comprovante ou confirmação de reserva:
- Se você souber o ID do voucher, compartilhe: https://webhook-six-topaz.vercel.app/api/vouchers/{id}/download?token={token}
- Se não souber, diga: "Vou solicitar à equipe que prepare seu voucher e envie em breve."
```

---

## File List

- [x] `package.json` — adicionar pdf-lib
- [x] `database/migrations/010_vouchers.sql` — tabela vouchers
- [x] `services/voucher/voucher-generator.js` — geração PDF
- [x] `routes/vouchers.js` — API REST completa
- [x] `server.js` — montar /api/vouchers (1 linha)
- [x] `public/vouchers.html` — página CRM
- [x] `services/luna/system-prompt.js` — instrução de voucher (append)

---

## Tests

- [x] `tests/voucher/voucher-generator.test.js` — 21/21 ✅
- [x] `tests/voucher/vouchers.route.test.js` — 19/19 ✅

---

## Change Log

| Data | Autor | Ação |
|------|-------|------|
| 2026-03-12 | Morgan @pm | Story criada — Status: Ready |
| 2026-03-12 | Dex @dev | Implementação completa — 179/179 testes — Status: Done |
