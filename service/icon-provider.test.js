import test from 'node:test';
import assert from 'node:assert/strict';
import { createIconSuggester, getIconCapabilities } from './icon-provider.js';
import { ICONS } from './icons.js';

const config = { OPENAI_API_KEY: 'fake-openai-key', JEV_API_KEY: 'fake-typesafe-token', JEV_MODEL: 'jev-latest' };

test('Jev-only capabilities enable icons independently of OpenAI', () => {
  assert.deepEqual(getIconCapabilities({ JEV_API_KEY: 'fake' }),
    { mini: false, luna: false, jev: true, none: true, defaultProvider: 'jev' });
  assert.equal(getIconCapabilities({}).defaultProvider, 'none');
  assert.equal(getIconCapabilities(config).defaultProvider, 'jev');
  assert.equal(getIconCapabilities({ OPENAI_API_KEY: 'fake' }).defaultProvider, 'mini');
});

test('Luna and mini use their exact models and constrained icon output', async () => {
  const calls = [];
  const suggest = createIconSuggester({ config, openai: { chat: { completions: { create: async (body, options) => {
    calls.push({ body, options });
    return { choices: [{ finish_reason: 'stop', message: { content: '{"icon":"shopping"}' } }] };
  } } } } });
  assert.deepEqual(await suggest('Milch einkaufen', 'luna'), { icon: 'shopping' });
  assert.equal(calls[0].body.model, 'gpt-6-luna');
  assert.equal(calls[0].body.reasoning_effort, 'none');
  assert.equal(calls[0].body.temperature, undefined);
  assert.deepEqual(calls[0].body.response_format.json_schema.schema.properties.icon.enum, Object.keys(ICONS));
  assert.equal(calls[0].options.maxRetries, 0);
  await suggest('Milch einkaufen', 'mini');
  assert.equal(calls[1].body.model, 'gpt-4.1-mini');
  assert.equal(calls[1].body.temperature, 0);
});

test('Jev sends a native choice question only to TypeSafe and normalizes its answer', async () => {
  const suggest = createIconSuggester({ config, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer fake-typesafe-token');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'jev-latest');
    assert.equal(body.state, 'Milch einkaufen');
    assert.equal(body.questions.icon.type, 'choice');
    assert.deepEqual(body.questions.icon.criteria, ICONS);
    return Response.json({ answers: { icon: { type: 'choice', choice: 'shopping', confidence: 0.9 } } });
  } });
  assert.deepEqual(await suggest('Milch einkaufen'), { icon: 'shopping' });
});

test('none, unknown and unconfigured providers do not call any API', async () => {
  const suggest = createIconSuggester({ config: {}, fetchImpl: () => { throw new Error('Unexpected API call'); } });
  assert.deepEqual(await suggest('Milch einkaufen', 'none'), { icon: 'other' });
  await assert.rejects(suggest('Milch einkaufen', 'jev'), { status: 503 });
  await assert.rejects(suggest('Milch einkaufen', 'unknown'), { status: 400 });
});

test('upstream errors are sanitized and never trigger a different provider', async () => {
  for (const [status, code] of [[401, 'ICON_AUTH_FAILED'], [403, 'ICON_AUTH_FAILED'], [402, 'ICON_CREDIT_REQUIRED'], [429, 'ICON_RATE_LIMITED'], [503, 'ICON_REQUEST_FAILED']]) {
    let calls = 0;
    const suggest = createIconSuggester({ config, fetchImpl: async () => {
      calls++; return new Response('fake-typesafe-token private response', { status });
    } });
    await assert.rejects(suggest('Milch einkaufen', 'jev'), error => {
      assert.equal(error.code, code); assert.ok(!error.message.includes(config.JEV_API_KEY)); return true;
    });
    assert.equal(calls, 1);
  }
});

test('malformed, unknown and incomplete model responses fail safely', async () => {
  for (const result of [{}, { answers: { icon: { type: 'noul', choice: 'shopping' } } }, { answers: { icon: { type: 'choice', choice: '<svg>' } } }]) {
    const suggest = createIconSuggester({ config, fetchImpl: async () => Response.json(result) });
    await assert.rejects(suggest('Milch einkaufen', 'jev'), { status: 502, code: 'ICON_REQUEST_FAILED' });
  }
  const suggest = createIconSuggester({ config, fetchImpl: async () => { throw new DOMException('timed out', 'TimeoutError'); } });
  await assert.rejects(suggest('Milch einkaufen', 'jev'), { status: 504, code: 'ICON_TIMEOUT' });
});
