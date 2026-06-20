'use strict';

/**
 * Testes da montagem de ofertas públicas (DEC-025 Bloco 2).
 * Função pura — calcQuote é injetado (stub), sem tocar Supabase nem o engine.
 * Run: node --test tests/quotation/public-offers.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildOffers } = require('../../services/quotation/public-offers');

// rooms físicos por ala: A cabe 3 (2 quartos), B cabe 5 (2 quartos), C cabe 8 (2 quartos)
const ROOMS = {
  A: { maxGuests: 3, totalRooms: 2 },
  B: { maxGuests: 5, totalRooms: 2 },
  C: { maxGuests: 8, totalRooms: 2 },
};

// Stub de cotação: preço determinístico = 100 por ala (A=100, B=200, C=300) * noites.
function stubQuote({ tipo, pessoas }) {
  const base = { ALA_A: 100, ALA_B: 200, ALA_C_CASAL: 300 }[tipo];
  return { tipoLabel: `Label ${tipo}`, totalFinal: base, desconto: 0, breakdown: [{ season: 'baixa', price: base, nights: 1 }] };
}

function run(args) {
  return buildOffers({
    checkin: '2026-08-10', checkout: '2026-08-11', guests: args.guests,
    nights: 1, roomsByAla: ROOMS, sellableMap: args.sellableMap || new Map(),
    calcQuote: args.calcQuote || stubQuote,
  });
}

describe('buildOffers — capacidade', () => {
  it('2 hóspedes → todas as alas cabem (A, B, C)', () => {
    const r = run({ guests: 2 });
    assert.deepEqual(r.offers.map(o => o.room_type).sort(), ['ALA_A', 'ALA_B', 'ALA_C_CASAL']);
    assert.equal(r.group_inquiry, false);
  });

  it('4 hóspedes → Ala A (máx 3) fica de fora', () => {
    const r = run({ guests: 4 });
    assert.ok(!r.offers.find(o => o.room_type === 'ALA_A'));
    assert.ok(r.offers.find(o => o.room_type === 'ALA_B'));
  });

  it('10 hóspedes → nenhuma ala cabe → group_inquiry', () => {
    const r = run({ guests: 10 });
    assert.equal(r.offers.length, 0);
    assert.equal(r.group_inquiry, true);
  });
});

describe('buildOffers — disponibilidade (vw_ala_sellable)', () => {
  it('ausência de linha no mapa = ala cheia (disponível)', () => {
    const r = run({ guests: 2, sellableMap: new Map() });
    assert.ok(r.offers.every(o => o.available === true));
  });

  it('sellable 0 numa noite → ala marcada como indisponível, mas ainda listada com preço', () => {
    const r = run({ guests: 2, sellableMap: new Map([['A|2026-08-10', 0]]) });
    const a = r.offers.find(o => o.room_type === 'ALA_A');
    assert.equal(a.available, false);
    assert.equal(a.total_price, 100); // preço ainda calculado
  });

  it('disponíveis vêm antes de esgotadas e ordenadas por menor preço', () => {
    const r = run({ guests: 2, sellableMap: new Map([['B|2026-08-10', 0]]) });
    // B esgotada deve ir para o fim; A (100) antes de C (300)
    assert.equal(r.offers[0].room_type, 'ALA_A');
    assert.equal(r.offers[r.offers.length - 1].room_type, 'ALA_B');
    assert.equal(r.offers[r.offers.length - 1].available, false);
  });
});

describe('buildOffers — mínimo de noites (repassa erro do engine)', () => {
  it('quote com erro de min_nights → notice + min_nights, sem preço', () => {
    const calcQuote = ({ tipo }) => ({
      tipoLabel: `Label ${tipo}`,
      error: 'Para Carnaval, nossa estadia mínima é de 2 noites',
      minNights: 2,
      suggestion: 'Posso montar a cotação para 2 noites?',
    });
    const r = run({ guests: 2, calcQuote });
    const a = r.offers.find(o => o.room_type === 'ALA_A');
    assert.equal(a.total_price, null);
    assert.equal(a.min_nights, 2);
    assert.match(a.notice, /2 noites/);
  });
});
