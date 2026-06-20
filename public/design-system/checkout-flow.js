/* ============================================================
 * Checkout Flow — fluxo COMPLETO de check-out, compartilhado por
 * rooms, map e bookings. Extraído do rooms.html (fonte do baseline em
 * docs/qa/checkout-flow-baseline.md) sem alterar o comportamento.
 * ------------------------------------------------------------
 * Etapas (idênticas ao que o rooms fazia inline):
 *   1. Contagem do frigobar (se o quarto tem itens) → consumidos entram na
 *      comanda; restantes ficam (keep) ou voltam ao estoque (return).
 *   2. Confirmação + CheckoutGuard.run (trava de saldo no banco + popup de
 *      pagamento PIX/dinheiro/cartão + finalização canônica).
 *   3. Voucher final com diárias + consumos.
 *
 * Self-injeta o modal de contagem do frigobar (como o CheckoutGuard injeta
 * o popup de pagamento), então NÃO depende do DOM de nenhuma página.
 *
 * Uso:
 *   const { done, voucher } = await CheckoutFlow.run({
 *     reservationId, roomCode, apiFetch, toast,
 *   });
 *   // a página chamadora faz: toast de sucesso, abrir voucher e reload.
 *
 * Contrato do apiFetch: (path, { method, body }) com body como OBJETO
 * (mesmo contrato do CheckoutGuard). rooms/map passam o adapter cgApiFetch;
 * bookings passa DS.api (já trabalha com objeto).
 * ============================================================ */
(function () {
  'use strict';
  if (window.CheckoutFlow) return;

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmt = (v) => BRL.format(Number(v) || 0);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let injected = false;
  let fbCtx = null; // { roomCode, reservationId, apiFetch, toast, resolve }

  function ensureModal() {
    if (injected) return;
    injected = true;

    const style = document.createElement('style');
    style.textContent = `
      .cf-overlay{position:fixed;inset:0;background:rgba(2,6,12,.8);z-index:620;display:none;align-items:center;justify-content:center}
      .cf-overlay.open{display:flex}
      .cf-modal{background:var(--bg1,#0d1520);border:1px solid var(--bdr1,#1e2a3a);border-radius:var(--r-lg,14px);width:540px;max-width:calc(100vw - 32px);max-height:92vh;display:flex;flex-direction:column;color:var(--tx1,#e8eef6)}
      .cf-head{padding:16px;border-bottom:1px solid var(--bdr1,#1e2a3a)}
      .cf-title{font-size:1.0625rem;font-weight:700}
      .cf-sub{font-size:.8125rem;color:var(--tx3,#7c8aa0);margin-top:2px}
      .cf-body{padding:16px;flex:1 1 auto;min-height:0;overflow-y:auto}
      .cf-table{width:100%;border-collapse:collapse;font-size:.8rem}
      .cf-table th{text-align:left;padding:6px 8px;color:var(--tx3,#7c8aa0);font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--bdr1,#1e2a3a)}
      .cf-table td{padding:6px 8px;border-bottom:1px solid var(--bdr0,#16202c);color:var(--tx2,#aab6c8)}
      .cf-qty{width:70px;padding:4px 8px;font-size:.8rem;text-align:right;background:var(--sur1,#0f1a26);border:1px solid var(--bdr1,#1e2a3a);border-radius:6px;color:var(--tx1,#e8eef6)}
      .cf-rest{display:flex;gap:16px;margin-top:16px}
      .cf-rest label{font-size:.8125rem;color:var(--tx1,#e8eef6);cursor:pointer}
      .cf-restlabel{font-size:.8125rem;font-weight:600;color:var(--tx2,#aab6c8);margin-top:16px}
      .cf-err{color:#f87171;font-size:.78rem;display:none;margin-top:12px}
      .cf-foot{padding:12px 16px;border-top:1px solid var(--bdr1,#1e2a3a);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
      .cf-btn{height:34px;padding:0 14px;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;border:1px solid transparent}
      .cf-btn-ghost{background:transparent;border-color:var(--bdr1,#1e2a3a);color:var(--tx2,#aab6c8)}
      .cf-btn-go{background:var(--gold,#d4a017);border-color:var(--gold,#d4a017);color:#000}
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.className = 'cf-overlay';
    el.id = 'cf-overlay';
    el.innerHTML = `
      <div class="cf-modal" role="dialog" aria-modal="true">
        <div class="cf-head">
          <div class="cf-title">🧊 Contagem do frigobar</div>
          <div class="cf-sub" id="cf-sub">Informe o que o hóspede consumiu — será lançado na comanda</div>
        </div>
        <div class="cf-body">
          <table class="cf-table">
            <thead><tr><th>Item</th><th style="text-align:right">No frigobar</th><th style="text-align:right">Consumido</th></tr></thead>
            <tbody id="cf-items"></tbody>
          </table>
          <div class="cf-restlabel">Itens restantes após o checkout</div>
          <div class="cf-rest">
            <label><input type="radio" name="cf-rest" value="keep" checked> Deixar no frigobar</label>
            <label><input type="radio" name="cf-rest" value="return"> Devolver ao estoque/bar</label>
          </div>
          <div class="cf-err" id="cf-err"></div>
        </div>
        <div class="cf-foot">
          <button class="cf-btn cf-btn-ghost" id="cf-cancel">Cancelar</button>
          <button class="cf-btn cf-btn-go" id="cf-continue">Lançar e continuar checkout</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    el.addEventListener('click', (e) => { if (e.target === el) closeFb(false); });
    document.getElementById('cf-cancel').addEventListener('click', () => closeFb(false));
    document.getElementById('cf-continue').addEventListener('click', onFbContinue);
  }

  function closeFb(result) {
    document.getElementById('cf-overlay').classList.remove('open');
    const c = fbCtx; fbCtx = null;
    if (c && c.resolve) c.resolve(result === true);
  }

  // Reproduz o handler `fbc-continue` do rooms: lança consumos + trata restantes.
  async function onFbContinue() {
    if (!fbCtx) return;
    const { roomCode, reservationId, apiFetch } = fbCtx;
    const errEl = document.getElementById('cf-err');
    errEl.style.display = 'none';
    const btn = document.getElementById('cf-continue');
    btn.disabled = true; btn.textContent = 'Lançando…';

    try {
      for (const input of document.querySelectorAll('[data-cf-product]')) {
        const qty = parseFloat(input.value) || 0;
        if (qty <= 0) continue;
        const max = parseFloat(input.max) || 0;
        if (qty > max) throw new Error(`Consumido maior que o disponível no frigobar (máx ${max}).`);
        const r = await apiFetch('/api/room-charges', {
          method: 'POST',
          body: {
            reservation_id: reservationId,
            product_id:     input.dataset.cfProduct,
            quantity:       qty,
            room_code:      roomCode,
            from_frigobar:  true,
            staff_note:     'Contagem do frigobar no checkout',
          },
        });
        if (!r || !r.success) throw new Error((r && r.message) || 'Erro ao lançar consumo do frigobar.');
      }

      const rest = document.querySelector('[name="cf-rest"]:checked')?.value;
      if (rest === 'return') {
        const fb = await apiFetch(`/api/rooms/${roomCode}/frigobar`);
        for (const item of ((fb && fb.items) || [])) {
          if (Number(item.quantity) <= 0) continue;
          const r = await apiFetch(`/api/rooms/${roomCode}/frigobar/unload`, {
            method: 'POST',
            body: { product_id: item.products?.id, quantity: Number(item.quantity) },
          });
          if (!r || !r.success) throw new Error((r && r.message) || 'Erro ao devolver itens ao estoque.');
        }
      }

      closeFb(true);
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'Lançar e continuar checkout';
    }
  }

  // Abre o modal de contagem e resolve true (lançou) / false (cancelou).
  function frigobarCount(o) {
    return new Promise((resolve) => {
      ensureModal();
      fbCtx = { ...o, resolve };
      document.getElementById('cf-sub').textContent =
        `${o.roomCode} · ${o.guestName || ''} — consumido será lançado na comanda`;
      document.getElementById('cf-items').innerHTML = o.items.map((i) => `<tr>
        <td style="color:var(--tx1,#e8eef6)">${esc(i.products?.name || '—')}</td>
        <td style="text-align:right">${Number(i.quantity)} ${esc(i.products?.unit || '')}</td>
        <td style="text-align:right">
          <input class="cf-qty" type="number" min="0" max="${Number(i.quantity)}" value="0"
            data-cf-product="${i.products?.id}">
        </td>
      </tr>`).join('');
      const keep = document.querySelector('[name="cf-rest"][value="keep"]');
      if (keep) keep.checked = true;
      document.getElementById('cf-err').style.display = 'none';
      document.getElementById('cf-overlay').classList.add('open');
    });
  }

  /**
   * Executa o fluxo completo de check-out.
   * @returns {Promise<{done:boolean, voucher:object|null}>}
   */
  async function run(opts) {
    const { reservationId, roomCode } = opts;
    const apiFetch = opts.apiFetch;
    const toast = opts.toast || (window.DS && window.DS.toast) || function () {};

    // 1. Contagem do frigobar (só se o quarto tiver itens)
    if (roomCode) {
      let fb = null;
      try { fb = await apiFetch(`/api/rooms/${roomCode}/frigobar`); } catch (e) { fb = null; }
      const items = ((fb && fb.items) || []).filter((i) => Number(i.quantity) > 0);
      if (items.length) {
        const proceed = await frigobarCount({ items, roomCode, reservationId, apiFetch, guestName: opts.guestName });
        if (!proceed) return { done: false, voucher: null };
      }
    }

    // 2. Comanda fresca (totais + consumos já incluindo o frigobar lançado)
    let cmd = null;
    try { cmd = await apiFetch(`/api/room-charges/comanda/${reservationId}`); } catch (e) { cmd = null; }
    if (!cmd || !cmd.success) { toast('Erro ao carregar a comanda.', 'err'); return { done: false, voucher: null }; }
    const r = cmd.reservation || {};
    const charges = cmd.charges || [];
    const totals = cmd.totals || {};

    // 3. CheckoutGuard: trava de saldo no banco + popup de pagamento + finalização.
    // (Sem confirm() nativo: as 3 telas vão direto ao fluxo de pagamento — a
    // confirmação real é o popup de saldo/pagamento do CheckoutGuard.)
    const done = await window.CheckoutGuard.run({ id: reservationId, apiFetch, toast });
    if (!done) return { done: false, voucher: null };

    // 5. Voucher final com diárias + consumos
    const consumosTxt = charges.length
      ? 'Consumos: ' + charges.map((c) => `${Number(c.quantity)}x ${c.products?.name} (${fmt(c.total)})`).join(', ')
      : 'Sem consumos lançados';
    let voucher = null;
    try {
      voucher = await apiFetch('/api/vouchers', {
        method: 'POST',
        body: {
          reservation_id: reservationId,
          guest_name:   r.leads?.name || 'Hóspede',
          room_type:    roomCode || r.room_type,
          check_in:     r.checkin_date,
          check_out:    r.checkout_date,
          guests:       r.guests || 1,
          source:       'direct',
          total_amount: totals.grand_total,
          notes:        `Checkout. Diárias ${fmt(totals.room_total)} + consumos ${fmt(totals.charges_total)}. ${consumosTxt}`,
        },
      });
    } catch (e) { voucher = null; }

    return { done: true, voucher };
  }

  window.CheckoutFlow = { run };
})();
