'use strict';

const { Router } = require('express');
const { supabaseAdmin } = require('../services/supabase/client');
const { ok, fail, serverError } = require('../services/utils/response');

const router = Router();

// Helper: fetch the single active config row
async function fetchCurrent() {
  const { data, error } = await supabaseAdmin
    .from('luna_config')
    .select('*')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { current: data, error };
}

// GET /api/luna-config
// Returns the active Luna configuration
router.get('/', async (req, res) => {
  try {
    const { current, error } = await fetchCurrent();
    if (error) return serverError(res, error);
    return ok(res, { config: current });
  } catch (err) {
    return serverError(res, err);
  }
});

// GET /api/luna-config/history
// Returns last 10 saved versions
router.get('/history', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('luna_config_history')
      .select('*')
      .order('version', { ascending: false })
      .limit(10);

    if (error) return serverError(res, error);
    return ok(res, { history: data || [], count: (data || []).length });
  } catch (err) {
    return serverError(res, err);
  }
});

// PUT /api/luna-config
// Saves a new config version.
// Archives the current config to history (keeps last 10), then updates.
router.put('/', async (req, res) => {
  try {
    const { system_prompt, personality, scripts, active_packages } = req.body;
    const updated_by = req.user?.email || 'admin';

    const { current, error: fetchError } = await fetchCurrent();
    if (fetchError) return serverError(res, fetchError);

    const nextVersion = current ? current.version + 1 : 1;

    // Archive current version to history
    if (current) {
      const { error: histInsertError } = await supabaseAdmin
        .from('luna_config_history')
        .insert({
          system_prompt: current.system_prompt,
          personality:   current.personality,
          scripts:       current.scripts,
          active_packages: current.active_packages,
          version:       current.version,
          saved_at:      current.updated_at,
          saved_by:      current.updated_by,
        });
      if (histInsertError) return serverError(res, histInsertError);

      // Prune history: keep only the 10 most recent
      const { data: allHistory } = await supabaseAdmin
        .from('luna_config_history')
        .select('id')
        .order('version', { ascending: false });

      if (allHistory && allHistory.length > 10) {
        const toDelete = allHistory.slice(10).map(r => r.id);
        await supabaseAdmin.from('luna_config_history').delete().in('id', toDelete);
      }
    }

    const payload = {
      system_prompt:   system_prompt   ?? current?.system_prompt   ?? '',
      personality:     personality     ?? current?.personality     ?? {},
      scripts:         scripts         ?? current?.scripts         ?? {},
      active_packages: active_packages ?? current?.active_packages ?? [],
      version:    nextVersion,
      updated_at: new Date().toISOString(),
      updated_by,
    };

    let saved;
    if (current) {
      const { data, error } = await supabaseAdmin
        .from('luna_config')
        .update(payload)
        .eq('id', current.id)
        .select()
        .single();
      if (error) return serverError(res, error);
      saved = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('luna_config')
        .insert(payload)
        .select()
        .single();
      if (error) return serverError(res, error);
      saved = data;
    }

    return ok(res, { config: saved, version: nextVersion });
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /api/luna-config/restore/:version
// Restores a historical version as the new current
router.post('/restore/:version', async (req, res) => {
  try {
    const targetVersion = parseInt(req.params.version, 10);
    if (isNaN(targetVersion)) return fail(res, 'invalid_param', 'Version must be a number', 400);

    const updated_by = req.user?.email || 'admin';

    const { data: historical, error: histError } = await supabaseAdmin
      .from('luna_config_history')
      .select('*')
      .eq('version', targetVersion)
      .maybeSingle();

    if (histError) return serverError(res, histError);
    if (!historical) return fail(res, 'not_found', `Version ${targetVersion} not found in history`, 404);

    // Treat as a new save with restored content
    req.body = {
      system_prompt:   historical.system_prompt,
      personality:     historical.personality,
      scripts:         historical.scripts,
      active_packages: historical.active_packages,
    };
    req.user = { email: updated_by };

    // Re-use the PUT logic by delegating to a recursive call would cause issues;
    // inline the save logic instead
    const { current, error: fetchError } = await fetchCurrent();
    if (fetchError) return serverError(res, fetchError);

    const nextVersion = current ? current.version + 1 : 1;

    if (current) {
      await supabaseAdmin.from('luna_config_history').insert({
        system_prompt:   current.system_prompt,
        personality:     current.personality,
        scripts:         current.scripts,
        active_packages: current.active_packages,
        version:         current.version,
        saved_at:        current.updated_at,
        saved_by:        current.updated_by,
      });

      const { data: allHistory } = await supabaseAdmin
        .from('luna_config_history')
        .select('id')
        .order('version', { ascending: false });

      if (allHistory && allHistory.length > 10) {
        const toDelete = allHistory.slice(10).map(r => r.id);
        await supabaseAdmin.from('luna_config_history').delete().in('id', toDelete);
      }
    }

    const payload = {
      system_prompt:   historical.system_prompt,
      personality:     historical.personality,
      scripts:         historical.scripts,
      active_packages: historical.active_packages,
      version:    nextVersion,
      updated_at: new Date().toISOString(),
      updated_by: `${updated_by} (restored v${targetVersion})`,
    };

    let saved;
    if (current) {
      const { data, error } = await supabaseAdmin
        .from('luna_config')
        .update(payload)
        .eq('id', current.id)
        .select()
        .single();
      if (error) return serverError(res, error);
      saved = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('luna_config')
        .insert(payload)
        .select()
        .single();
      if (error) return serverError(res, error);
      saved = data;
    }

    return ok(res, { config: saved, version: nextVersion, restored_from: targetVersion });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
