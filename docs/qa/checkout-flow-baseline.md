# Baseline — Checkout do rooms.html (antes da extração para checkout-flow.js)

Registro do comportamento atual do checkout do `rooms.html` para provar, após a
extração do módulo compartilhado, que o fluxo permanece **idêntico**.

Fonte: `public/rooms.html` (handlers `btn-do-checkout`, `fbc-continue`, `finishCheckout`).

## Sequência canônica (rooms, hoje)

### 1. Clique em "🚪 Fazer checkout" (`btn-do-checkout`)
- `GET /api/rooms/{roomCode}/frigobar`
- Filtra itens com `quantity > 0`.
- **Se há itens:** abre o modal "🧊 Contagem do frigobar" (`modal-fb-checkout`) e PARA.
- **Se não há itens:** chama `finishCheckout()` direto.

### 2. Modal de contagem do frigobar (`fbc-continue`)
Tabela: Item · No frigobar · **Consumido** (input number, `max` = qtd no frigobar).
Rádio "Itens restantes": `keep` (Deixar no frigobar, default) | `return` (Devolver ao estoque/bar).

Ao confirmar ("Lançar e continuar checkout"):
- Para cada item com `consumido > 0`:
  - valida `consumido <= max` (senão erro `Consumido maior que o disponível no frigobar (máx N).`)
  - `POST /api/room-charges` body:
    ```json
    { "reservation_id": <id>, "product_id": <id>, "quantity": <consumido>,
      "room_code": <roomCode>, "from_frigobar": true,
      "staff_note": "Contagem do frigobar no checkout" }
    ```
- Se rádio = `return`:
  - `GET /api/rooms/{roomCode}/frigobar` → para cada item `quantity > 0`:
    - `POST /api/rooms/{roomCode}/frigobar/unload` body `{ product_id, quantity }`
- `refreshComanda()` (recarrega a comanda — agora inclui o consumo do frigobar)
- fecha o modal e chama `finishCheckout()`.

### 3. `finishCheckout()`
- `confirm("Fazer checkout de {nome} ({roomCode})?\nTotal da comanda: {grand_total}")` — cancelar aborta.
- `CheckoutGuard.run({ id, apiFetch: cgApiFetch, toast: showToast })`
  - trava de saldo no banco (RPC `checkout_reservation` via `PATCH /api/reservations/:id/checkout`)
  - se `balance_due` → popup de pagamento (PIX/dinheiro/cartão) → `POST /api/payments/manual` → retenta
  - retorna `true` só quando finalizou (sem saldo ou após receber)
  - se `false` → aborta (não gera voucher)
- **Voucher** `POST /api/vouchers` body:
  ```json
  { "reservation_id": <id>, "guest_name": <nome|"Hóspede">, "room_type": <roomCode>,
    "check_in": <checkin_date>, "check_out": <checkout_date>, "guests": <guests|1>,
    "source": "direct", "total_amount": <grand_total>,
    "notes": "Checkout. Diárias {room_total} + consumos {charges_total}. {consumosTxt}" }
  ```
  - `consumosTxt` = `"Consumos: Nx Produto (R$ Y), ..."` ou `"Sem consumos lançados"`.
- `showToast('Checkout registrado.', 'ok')`
- se `voucher.download_url` → `window.open(download_url, '_blank')`
- `loadRooms()` (reload da tela)

## Valores que DEVEM bater (fonte única — endpoint da comanda)
`GET /api/room-charges/comanda/:id` → `totals`:
- `room_total` = diárias (`reservations.total_amount`)
- `charges_total` = soma dos consumos
- `grand_total` = room_total + charges_total
- `deposit_paid` = sinal (`reservations.deposit_amount`)
- `payments_confirmed` = pagamentos de saldo confirmados
- `balance_due` = room_total + charges_total − deposit − payments_confirmed

## Contrato de reuso pós-extração
`CheckoutFlow.run({ reservationId, roomCode, apiFetch, toast })` → `{ done, voucher }`
reproduz os passos 1–3 acima. O `apiFetch` segue o contrato do CheckoutGuard
(body como **objeto**). A página chamadora faz apenas: toast de sucesso, abrir
voucher e reload — exatamente como o `finishCheckout` fazia no final.
