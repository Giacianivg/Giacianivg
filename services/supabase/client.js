'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — DB calls will fail');
}

// Bypasses RLS — used by webhook and internal API calls
const supabaseAdmin = createClient(
  SUPABASE_URL  || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
  { auth: { persistSession: false } }
);

// Respects RLS — used by dashboard (pass JWT from Authorization header)
const supabasePublic = createClient(
  SUPABASE_URL  || 'http://localhost:54321',
  SUPABASE_ANON_KEY || 'placeholder',
  { auth: { persistSession: false } }
);

module.exports = { supabaseAdmin, supabasePublic };
