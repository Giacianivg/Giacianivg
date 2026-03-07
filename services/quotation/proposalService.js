'use strict';

const { calculateQuotation } = require('./engine');
const { supabaseAdmin } = require('../supabase/client');
const { toDB } = require('../utils/dates');

/**
 * Create a proposal in Supabase from quotation engine output.
 * Wraps calculateQuotation() + Supabase insert in one call.
 *
 * @param {object} opts
 * @param {string} opts.leadId
 * @param {string} opts.roomType  - ALA_A | ALA_B | ALA_C_CASAL
 * @param {string} opts.checkin   - DD/MM/YYYY
 * @param {string} opts.checkout  - DD/MM/YYYY
 * @param {number} opts.guests
 * @returns {{ proposal_number, proposal_id, total, deposit, quotation }}
 */
async function createProposalFromQuotation({ leadId, roomType, checkin, checkout, guests }) {
  const quotation = calculateQuotation({
    tipo: roomType,
    data_entrada: checkin,
    data_saida: checkout,
    pessoas: Number(guests),
  });

  if (quotation.error || quotation.escalar) {
    throw new Error(quotation.escalar ? 'room_requires_human' : quotation.error);
  }

  const deposit = Math.round(quotation.totalFinal * 0.30);
  const expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('proposals')
    .insert({
      lead_id:        leadId,
      room_type:      roomType,
      checkin_date:   toDB(checkin),
      checkout_date:  toDB(checkout),
      guests:         Number(guests),
      total_amount:   quotation.totalFinal,
      deposit_amount: deposit,
      expires_at,
    })
    .select('id, proposal_number')
    .single();

  if (error) throw new Error(`Proposal insert failed: ${error.message}`);

  return {
    proposal_id:     data.id,
    proposal_number: data.proposal_number,
    total:           quotation.totalFinal,
    deposit,
    quotation,
  };
}

module.exports = { createProposalFromQuotation };
