'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { buildOffers } = require('../../services/quotation/public-offers');

// calcQuote injetável: evita o engine real e devolve uma cotação determinística.
function fakeQuote() {
  return { tipoLabel: 'Ala A — Casal', totalFinal: 660, breakdown: [], desconto: 0 };
}

const BASE = { checkin: '2026-07-20', checkout: '2026-07-23', guests: 2, nights: 3 };

test('buildOffers repassa description e amenities do quarto representante', () => {
  const roomsByAla = {
    A: {
      maxGuests: 3, totalRooms: 3,
      description: 'Quarto vista pomar, 1 cama de casal e 1 cama de solteiro.',
      amenities: ['Cama de casal', 'Cama de solteiro', 'Frigobar', 'Ventilador de teto'],
    },
  };
  const res = buildOffers({ ...BASE, roomsByAla, sellableMap: new Map(), calcQuote: fakeQuote });
  const a = res.offers.find((o) => o.room_type === 'ALA_A');
  assert.ok(a, 'oferta ALA_A presente');
  assert.strictEqual(a.description, 'Quarto vista pomar, 1 cama de casal e 1 cama de solteiro.');
  assert.deepStrictEqual(a.amenities, ['Cama de casal', 'Cama de solteiro', 'Frigobar', 'Ventilador de teto']);
  assert.strictEqual(a.total_price, 660);
});

test('buildOffers usa defaults seguros quando a ala não tem description/amenities', () => {
  const roomsByAla = { A: { maxGuests: 3, totalRooms: 1 } };
  const res = buildOffers({ ...BASE, roomsByAla, sellableMap: new Map(), calcQuote: fakeQuote });
  const a = res.offers.find((o) => o.room_type === 'ALA_A');
  assert.strictEqual(a.description, null);
  assert.deepStrictEqual(a.amenities, []);
  assert.strictEqual(a.max_guests, 3); // sem repMaxGuests → cai p/ o máx. da ala
});

test('buildOffers exibe a capacidade do quarto representante (repMaxGuests)', () => {
  // ala comporta até 4 (quarto familiar), mas p/ 2 hóspedes o representante é o
  // quarto casal (cap. 3) — o card deve mostrar 3, não 4.
  const roomsByAla = { A: { maxGuests: 4, repMaxGuests: 3, totalRooms: 8 } };
  const res = buildOffers({ ...BASE, roomsByAla, sellableMap: new Map(), calcQuote: fakeQuote });
  const a = res.offers.find((o) => o.room_type === 'ALA_A');
  assert.strictEqual(a.max_guests, 3);
});
