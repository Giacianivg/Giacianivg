/* ============================================================
 * Checkout Guard — fluxo ÚNICO de check-out para frontdesk, rooms e map.
 * ------------------------------------------------------------
 * A trava de saldo é no banco (RPC checkout_reservation, via
 * PATCH /api/reservations/:id/checkout). Este módulo cuida só do popup
 * de pagamento quando o backend responde balance_due — garantindo que
 * as três telas usem exatamente o mesmo caminho e o mesmo popup.
 *
 * Uso:
 *   const ok = await CheckoutGuard.run({ id, apiFetch, toast });
 *   // ok === true  → check-out finalizado (sem saldo ou após receber)
 *   // ok === false → cancelado ou saldo não recebido
 *
 * Contrato do apiFetch: (path, { method, body }) com body como OBJETO
 * (o frontdesk usa esse contrato nativamente; rooms/map passam um adapter
 * de 1 linha que serializa o body).
 * ============================================================ */
(function () {
  'use strict';
  if (window.CheckoutGuard) return;

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmt = (v) => BRL.format(Number(v) || 0);

  let ctx = null;        // { id, apiFetch, toast, resolve }
  let injected = false;

  function ensureModal() {
    if (injected) return;
    injected = true;

    const style = document.createElement('style');
    style.textContent = `
      .cg-overlay{position:fixed;inset:0;background:rgba(2,6,12,.8);z-index:600;display:none;align-items:center;justify-content:center}
      .cg-overlay.open{display:flex}
      .cg-modal{background:var(--bg1,#0d1520);border:1px solid var(--bdr1,#1e2a3a);border-radius:var(--r-lg,14px);width:420px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;color:var(--tx1,#e8eef6)}
      .cg-head{padding:16px;border-bottom:1px solid var(--bdr1,#1e2a3a)}
      .cg-title{font-size:1rem;font-weight:700}
      .cg-sub{font-size:.78rem;color:var(--tx3,#7c8aa0);margin-top:2px}
      .cg-body{padding:16px;display:flex;flex-direction:column;gap:12px}
      .cg-row{display:flex;justify-content:space-between;font-size:.8125rem;color:var(--tx2,#aab6c8)}
      .cg-row .v{font-weight:600;color:var(--tx1,#e8eef6)}
      .cg-due{border-top:1px solid var(--bdr1,#1e2a3a);padding-top:8px;font-size:.9rem}
      .cg-due .v{color:#f59e0b;font-weight:800;font-size:1.05rem}
      .cg-methods{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .cg-method{padding:10px 4px;text-align:center;background:var(--sur1,#0f1a26);border:1px solid var(--bdr1,#1e2a3a);border-radius:8px;cursor:pointer;font-size:.8rem;color:var(--tx2,#aab6c8)}
      .cg-method.sel{border-color:#22c55e;color:#22c55e;background:rgba(34,197,94,.08);font-weight:700}
      .cg-input{height:38px;padding:0 12px;background:var(--sur1,#0f1a26);border:1px solid var(--bdr1,#1e2a3a);border-radius:8px;color:var(--tx1,#e8eef6);font-size:.9rem;width:100%;box-sizing:border-box}
      .cg-label{font-size:.72rem;font-weight:700;color:var(--tx3,#7c8aa0);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
      .cg-foot{padding:12px 16px;border-top:1px solid var(--bdr1,#1e2a3a);display:flex;gap:8px;justify-content:flex-end}
      .cg-btn{height:34px;padding:0 14px;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;border:1px solid transparent}
      .cg-btn-ghost{background:transparent;border-color:var(--bdr1,#1e2a3a);color:var(--tx2,#aab6c8)}
      .cg-btn-go{background:rgba(34,197,94,.15);color:#22c55e;border-color:rgba(34,197,94,.4)}
      .cg-err{color:#f87171;font-size:.78rem;display:none}
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.className = 'cg-overlay';
    el.id = 'cg-overlay';
    el.innerHTML = `
      <div class="cg-modal" role="dialog" aria-modal="true">
        <div class="cg-head">
          <div class="cg-title">💰 Saldo em aberto</div>
          <div class="cg-sub" id="cg-sub">O check-out só é liberado após receber o saldo.</div>
        </div>
        <div class="cg-body">
          <div class="cg-row"><span>Diárias</span><span class="v" id="cg-room">—</span></div>
          <div class="cg-row"><span>Consumos</span><span class="v" id="cg-charges">—</span></div>
          <div class="cg-row"><span>Sinal pago</span><span class="v" id="cg-deposit" style="color:#22c55e">—</span></div>
          <div class="cg-row" id="cg-paid-row" style="display:none"><span>Pagamentos recebidos</span><span class="v" id="cg-paid" style="color:#22c55e">—</span></div>
          <div class="cg-row cg-due"><span>Saldo a receber</span><span class="v" id="cg-due">—</span></div>
          <div>
            <div class="cg-label">Forma de pagamento</div>
            <div class="cg-methods" id="cg-methods">
              <div class="cg-method sel" data-cg-method="pix">📱 PIX</div>
              <div class="cg-method" data-cg-method="cash">💵 Dinheiro</div>
              <div class="cg-method" data-cg-method="card">💳 Cartão</div>
            </div>
          </div>
          <div>
            <div class="cg-label">Valor recebido (R$)</div>
            <input class="cg-input" type="number" id="cg-amount" min="0" step="0.01">
          </div>
          <div class="cg-err" id="cg-err"></div>
        </div>
        <div class="cg-foot">
          <button class="cg-btn cg-btn-ghost" id="cg-cancel">Cancelar</button>
          <button class="cg-btn cg-btn-go" id="cg-confirm">✓ Receber e fazer check-out</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    el.querySelectorAll('[data-cg-method]').forEach((m) =>
      m.addEventListener('click', () => {
        el.querySelectorAll('[data-cg-method]').forEach((x) => x.classList.remove('sel'));
        m.classList.add('sel');
      })
    );
    el.addEventListener('click', (e) => { if (e.target === el) closeModal(false); });
    document.getElementById('cg-cancel').addEventListener('click', () => closeModal(false));
    document.getElementById('cg-confirm').addEventListener('click', onConfirm);
  }

  function fillModal(totals) {
    const t = totals || {};
    document.getElementById('cg-room').textContent    = fmt(t.room_total);
    document.getElementById('cg-charges').textContent = fmt(t.charges_total);
    document.getElementById('cg-deposit').textContent = '− ' + fmt(t.deposit_paid);
    const paid = Number(t.payments_confirmed || 0);
    document.getElementById('cg-paid-row').style.display = paid > 0 ? 'flex' : 'none';
    document.getElementById('cg-paid').textContent = '− ' + fmt(paid);
    document.getElementById('cg-due').textContent  = fmt(t.balance_due);
    document.getElementById('cg-amount').value = Number(t.balance_due || 0).toFixed(2);
    document.getElementById('cg-err').style.display = 'none';
  }

  function openModal(totals) {
    fillModal(totals);
    const btn = document.getElementById('cg-confirm');
    btn.disabled = false; btn.textContent = '✓ Receber e fazer check-out';
    document.getElementById('cg-overlay').classList.add('open');
  }

  function closeModal(result) {
    document.getElementById('cg-overlay').classList.remove('open');
    const c = ctx; ctx = null;
    if (c && c.resolve) c.resolve(result === true);
  }

  // Tenta o check-out pela trava do banco. Retorna o que aconteceu.
  async function attemptCheckout(id, apiFetch) {
    const res = await apiFetch(`/api/reservations/${id}/checkout`, { method: 'PATCH' });
    if (res && res.success) return { done: true, totals: res.totals };
    if (res && res.error === 'balance_due') return { balance: true, totals: res.totals || {}, message: res.message };
    return { error: true, message: (res && res.message) || 'Falha ao finalizar o check-out.' };
  }

  async function onConfirm() {
    if (!ctx) return;
    const err = document.getElementById('cg-err');
    err.style.display = 'none';
    const amount = parseFloat(document.getElementById('cg-amount').value) || 0;
    const method = document.querySelector('[data-cg-method].sel')?.dataset.cgMethod || 'pix';
    if (amount <= 0) { err.textContent = 'Informe o valor recebido.'; err.style.display = 'block'; return; }

    const btn = document.getElementById('cg-confirm');
    btn.disabled = true; btn.textContent = 'Registrando pagamento…';

    const pay = await ctx.apiFetch('/api/payments/manual', {
      method: 'POST',
      body: { reservation_id: ctx.id, amount, method, payment_type: 'balance' },
    });
    if (!pay || !pay.success) {
      btn.disabled = false; btn.textContent = '✓ Receber e fazer check-out';
      err.textContent = (pay && pay.message) || 'Erro ao registrar pagamento.';
      err.style.display = 'block';
      return;
    }

    // Retenta o check-out — pagamento parcial mantém o bloqueio.
    const co = await attemptCheckout(ctx.id, ctx.apiFetch);
    if (co.done) { closeModal(true); return; } // quem chamou run() emite o toast de sucesso
    if (co.balance) {
      btn.disabled = false; btn.textContent = '✓ Receber e fazer check-out';
      fillModal(co.totals);
      ctx.toast(`Pagamento de ${fmt(amount)} registrado — ainda faltam ${fmt(co.totals.balance_due)}.`, 'warn');
      return;
    }
    btn.disabled = false; btn.textContent = '✓ Receber e fazer check-out';
    err.textContent = co.message || 'Falha ao finalizar o check-out.';
    err.style.display = 'block';
  }

  /**
   * Executa o check-out guardado.
   * @returns {Promise<boolean>} true se finalizou (sem saldo ou após receber).
   */
  function run(opts) {
    const apiFetch = opts.apiFetch;
    const toast = opts.toast || (window.DS && window.DS.toast) || function () {};
    return new Promise((resolve) => {
      ensureModal();
      attemptCheckout(opts.id, apiFetch).then((co) => {
        if (co.done) { resolve(true); return; }           // sem saldo: banco já finalizou
        if (!co.balance) { toast(co.message, 'err'); resolve(false); return; }
        ctx = { id: opts.id, apiFetch, toast, resolve };
        openModal(co.totals);
      });
    });
  }

  window.CheckoutGuard = { run };
})();
