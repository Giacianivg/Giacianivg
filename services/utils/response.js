'use strict';

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

function fail(res, error, message, status = 400) {
  return res.status(status).json({ success: false, error, message });
}

function notFound(res, resource = 'Resource') {
  return fail(res, 'not_found', `${resource} not found`, 404);
}

function serverError(res, err) {
  console.error('[API error]', err);
  return fail(res, 'internal_error', err.message || 'Unexpected error', 500);
}

module.exports = { ok, fail, notFound, serverError };
