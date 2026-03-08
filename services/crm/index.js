'use strict';

/**
 * CRM Service — direct Supabase calls.
 * Single integration point between webhook and Supabase.
 * All methods are safe to call fire-and-forget (never throw, always log on error).
 */

const { supabaseAdmin } = require('../supabase/client');
const { toDB } = require('../utils/dates');

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

async function upsertLead(whatsapp, name, funnel_stage = 'new') {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .upsert(
      { whatsapp_number: whatsapp, name, funnel_stage, updated_at: new Date().toISOString() },
      { onConflict: 'whatsapp_number', ignoreDuplicates: false }
    )
    .select('id')
    .single();

  if (error) {
    console.error('[crm] upsertLead failed:', error.message);
    return null;
  }
  return data.id;
}

async function updateLeadStatus(leadId, funnel_stage) {
  if (!leadId) return;
  const { error } = await supabaseAdmin
    .from('leads')
    .update({ funnel_stage, updated_at: new Date().toISOString() })
    .eq('id', leadId);
  if (error) console.error('[crm] updateLeadStatus failed:', error.message);
}

async function updateLeadName(leadId, name) {
  if (!leadId || !name) return;
  const { error } = await supabaseAdmin
    .from('leads')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', leadId);
  if (error) console.error('[crm] updateLeadName failed:', error.message);
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

async function recordConversation(leadId, whatsapp, role, content, timestamp) {
  if (!leadId || !whatsapp || !content) return;

  const payload = { lead_id: leadId, whatsapp_number: whatsapp, role, content };

  // Use timestamp from WhatsApp if provided (Unix seconds → ISO 8601)
  if (timestamp) {
    const isoDate = new Date(parseInt(timestamp) * 1000).toISOString();
    payload.created_at = isoDate;
  }

  const { error } = await supabaseAdmin.from('conversations').insert(payload);
  if (error) console.error('[crm] recordConversation failed:', error.message);
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

async function checkAvailability(roomType, checkin, checkout) {
  let checkinISO, checkoutISO;
  try {
    checkinISO  = toDB(checkin);
    checkoutISO = toDB(checkout);
  } catch {
    return { available: false, error: 'invalid_date' };
  }

  // For ALA_C_CASAL: check if ANY of ALA_C_1 or ALA_C_2 is fully free
  const roomsToCheck = roomType === 'ALA_C_CASAL' ? ['ALA_C_1', 'ALA_C_2'] : [roomType];

  for (const rt of roomsToCheck) {
    const { data, error } = await supabaseAdmin
      .from('availability')
      .select('date, status')
      .eq('room_type', rt)
      .gte('date', checkinISO)
      .lt('date', checkoutISO);

    if (error) {
      console.error('[crm] checkAvailability failed:', error.message);
      return { available: null, error: 'db_error' }; // null = unknown, caller should fallback
    }

    const allAvailable = data.length > 0 && data.every(r => r.status === 'available');
    if (allAvailable) return { available: true, room_type: rt };
  }

  return { available: false, room_type: roomType };
}

async function fetchAlternativeDates(roomType, fromDate, nights = 2, maxWindows = 3) {
  let fromISO;
  try { fromISO = toDB(fromDate); } catch { return []; }

  // Look up to 60 days ahead for available windows
  const toDate = new Date(fromISO);
  toDate.setDate(toDate.getDate() + 60);
  const toISO = toDate.toISOString().slice(0, 10);

  const roomsToCheck = roomType === 'ALA_C_CASAL' ? ['ALA_C_1', 'ALA_C_2'] : [roomType];

  const { data, error } = await supabaseAdmin
    .from('availability')
    .select('date, status, room_type')
    .in('room_type', roomsToCheck)
    .gte('date', fromISO)
    .lt('date', toISO)
    .eq('status', 'available')
    .order('date');

  if (error || !data) return [];

  // Group available dates by room_type
  const byRoom = {};
  for (const row of data) {
    if (!byRoom[row.room_type]) byRoom[row.room_type] = new Set();
    byRoom[row.room_type].add(row.date);
  }

  const windows = [];
  for (const [rt, availDates] of Object.entries(byRoom)) {
    const sorted = [...availDates].sort();
    for (let i = 0; i <= sorted.length - nights; i++) {
      // Check if nights consecutive dates are all available
      let ok = true;
      for (let d = 1; d < nights; d++) {
        const next = new Date(sorted[i]);
        next.setDate(next.getDate() + d);
        if (!availDates.has(next.toISOString().slice(0, 10))) { ok = false; break; }
      }
      if (ok) {
        const checkoutD = new Date(sorted[i]);
        checkoutD.setDate(checkoutD.getDate() + nights);
        windows.push({ checkin: sorted[i], checkout: checkoutD.toISOString().slice(0, 10), room_type: rt });
        if (windows.length >= maxWindows) return windows;
        i += nights - 1; // skip ahead
      }
    }
    if (windows.length >= maxWindows) break;
  }
  return windows;
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

async function createReservation({ leadId, whatsapp, roomType, checkin, checkout, guests, totalAmount, depositAmount, proposalId = null }) {
  let checkinISO, checkoutISO;
  try {
    checkinISO  = toDB(checkin);
    checkoutISO = toDB(checkout);
  } catch (e) {
    return { success: false, error: 'invalid_date', message: e.message };
  }

  const { data, error } = await supabaseAdmin.rpc('create_reservation_atomic', {
    p_lead_id:        leadId,
    p_whatsapp:       whatsapp,
    p_room_type:      roomType,
    p_checkin:        checkinISO,
    p_checkout:       checkoutISO,
    p_guests:         Number(guests),
    p_total_amount:   Number(totalAmount),
    p_deposit_amount: Number(depositAmount),
    p_proposal_id:    proposalId,
  });

  if (error) {
    console.error('[crm] createReservation RPC failed:', error.message);
    return { success: false, error: 'rpc_error', message: error.message };
  }

  return data; // { success, reservation_number, reservation_id, room_type, error, message }
}

module.exports = {
  upsertLead,
  updateLeadStatus,
  updateLeadName,
  recordConversation,
  checkAvailability,
  fetchAlternativeDates,
  createReservation,
};
