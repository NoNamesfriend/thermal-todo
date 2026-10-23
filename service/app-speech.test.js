import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
process.env.OPENAI_API_KEY = '';
process.env.JEV_API_KEY = '';
const { createApp } = await import('./app.js');
const { SpeechError } = await import('./local-whisper.js');

async function withSpeech(run, overrides = {}) {
  const server = createApp({
    getSpeechCapabilities: async () => ({ local: true, openai: false, defaultProvider: 'local' }),
    transcribeLocalAudio: async buffer => { assert.equal(buffer.toString(), 'audio'); return { text: ' Lokal erkannt! ' }; },
    transcribeAudio: async () => { throw new Error('Cloud must not be called'); },
    ...overrides,
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const audio = async (query = '') => {
    const body = new FormData();
    body.append('audio', new Blob(['audio']), 'recording.webm');
    return fetch(`${base}/whisper${query}`, { method: 'POST', body });
  };
  try { await run({ base, audio }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('local speech works without an OpenAI key while icon suggestions remain disabled', async () => {
  await withSpeech(async ({ base, audio }) => {
    const config = await (await fetch(`${base}/config`)).json();
    assert.equal(config.ai, false);
    assert.equal(config.speech.local, true);
    assert.deepEqual(await (await audio()).json(), { text: 'Lokal erkannt' });
    assert.equal((await audio('?provider=openai')).status, 503);
    assert.equal((await audio('?provider=unknown')).status, 400);
    assert.equal((await audio('?provider=local&provider=openai')).status, 400);
    const response = await fetch(`${base}/icon-suggest`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task: 'Buy milk', provider: 'mini' }) });
    assert.equal(response.status, 503);
  });
});

test('unavailable speech and local busy/timeout states have safe, actionable responses', async () => {
  await withSpeech(async ({ audio }) => assert.equal((await audio()).status, 503), {
    getSpeechCapabilities: async () => ({ local: false, openai: false, defaultProvider: null }),
  });
  for (const [status, code] of [[429, 'SPEECH_BUSY'], [504, 'SPEECH_TIMEOUT']]) {
    await withSpeech(async ({ audio }) => {
      const response = await audio();
      assert.equal(response.status, status);
      assert.equal((await response.json()).code, code);
      if (status === 429) assert.equal(response.headers.get('retry-after'), '1');
    }, { transcribeLocalAudio: async () => { throw new SpeechError('Try again.', status, code); } });
  }
});
