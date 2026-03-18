'use strict';

// ---------------------------------------------------------------------------
// Luna AI Client — DeepSeek R1 com fallback para Claude Haiku
// Interface idêntica ao callClaude original: callLuna(messages, clientContext, attempt)
// ---------------------------------------------------------------------------

const LUNA_SYSTEM_PROMPT = require('./system-prompt');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

async function _callDeepSeek(system, messages) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-reasoner',
      max_tokens: 600,
      messages: [
        { role: 'system', content: system },
        ...messages,
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function _callHaiku(system, messages) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system,
      messages,
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

async function callLuna(messages, clientContext = '', attempt = 0) {
  const system = clientContext
    ? `${LUNA_SYSTEM_PROMPT}\n\n${clientContext}`
    : LUNA_SYSTEM_PROMPT;

  const isTransient = (err) =>
    err.message?.includes('fetch failed') || err.name === 'TimeoutError';

  // Tenta DeepSeek R1 se a chave estiver configurada
  if (DEEPSEEK_API_KEY) {
    try {
      const text = await _callDeepSeek(system, messages);
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', svc: 'luna', model: 'deepseek-reasoner' }));
      return text;
    } catch (err) {
      if (attempt === 0 && isTransient(err)) {
        console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', svc: 'luna', event: 'deepseek_transient_retry', msg: err.message }));
        await new Promise(r => setTimeout(r, 1000));
        return callLuna(messages, clientContext, 1);
      }
      console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', svc: 'luna', event: 'deepseek_fallback', msg: err.message }));
    }
  }

  // Fallback: Claude Haiku
  try {
    const text = await _callHaiku(system, messages);
    const label = DEEPSEEK_API_KEY ? 'claude-haiku (fallback)' : 'claude-haiku';
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', svc: 'luna', model: label }));
    return text;
  } catch (err) {
    if (attempt === 0 && isTransient(err)) {
      await new Promise(r => setTimeout(r, 1000));
      return callLuna(messages, clientContext, 1);
    }
    throw err;
  }
}

module.exports = { callLuna };
