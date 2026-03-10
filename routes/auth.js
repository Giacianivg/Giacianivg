'use strict';

const { Router } = require('express');
const path = require('path');

const router = Router();

// GET /auth/callback
// Supabase Auth redirect target for password recovery and email confirmation.
//
// IMPORTANT: The token lives in the URL hash (#access_token=...) or as a
// query param (?token_hash=... or ?code=...). The hash is NEVER sent to the
// server, so all exchange logic runs client-side in auth-callback.html.
// This route simply serves that page so the browser can read window.location.
router.get('/callback', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'auth-callback.html'));
});

module.exports = router;
