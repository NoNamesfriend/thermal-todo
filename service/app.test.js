import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.OPENAI_API_KEY = 'test-key-never-sent';
process.env.JEV_API_KEY = '';
const { createApp } = await import('./app.js');

async function withApp(run, overrides = {}) {
  const calls = [];
  const app = createApp({
    printImage: async image => calls.push(image),
    suggestIcon: async task => ({ icon: task === 'Buy milk' ? 'shopping' : 'other' }),
    preprocessAudio: async () => Buffer.alloc(2000),
    transcribeAudio: async (_, name) => { assert.equal(name, 'audio.webm'); return { text: ' Buy milk! ' }; },
    getSpeechCapabilities: async () => ({ local: false, openai: true, defaultProvider: 'openai' }),
    ...overrides,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body, headers = {}) => fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  try { await run({ base, post, calls }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('health and configuration are available without exposing credentials', async () => {
  await withApp(async ({ base }) => {
    assert.equal((await fetch(base + '/health')).status, 200);
    const config = await (await fetch(base + '/config')).json();
    assert.deepEqual(config, { ai: true, labelWidthMm: 80,
      icons: { mini: true, luna: true, jev: false, none: true, defaultProvider: 'mini' },
      speech: { local: false, openai: true, defaultProvider: 'openai' } });
  });
});

test('reject malformed print requests before reaching the printer', async () => {
  await withApp(async ({ post, calls }) => {
    for (const value of [{}, { image: 42 }, { image: 'data:image/png;base64,YWJj' }]) {
      assert.equal((await post('/print', value)).status, 400);
    }
    assert.equal(calls.length, 0);
  });
});

test('Jev-only setup routes icons without enabling OpenAI speech or exposing tokens', async () => {
  await withApp(async ({ base, post }) => {
    const config = await (await fetch(base + '/config')).json();
    assert.equal(config.ai, true);
    assert.equal(config.icons.jev, true);
    const result = await post('/icon-suggest', { task: ' Milch einkaufen ' });
    assert.deepEqual(await result.json(), { icon: 'shopping' });
    assert.equal((await post('/icon-suggest', { task: 'Milch einkaufen', provider: 'luna' })).status, 503);
    assert.equal((await post('/icon-suggest', { task: 'Milch einkaufen', provider: ['jev'] })).status, 400);
    assert.deepEqual(await (await post('/icon-suggest', { task: 'Milch einkaufen', provider: 'none' })).json(), { icon: 'other' });
  }, {
    getIconCapabilities: () => ({ mini: false, luna: false, jev: true, none: true, defaultProvider: 'jev' }),
    suggestIcon: async (task, provider) => { assert.equal(task, 'Milch einkaufen'); assert.equal(provider, 'jev'); return { icon: 'shopping' }; },
  });
});

test('valid PNG is sent to the printer once', async () => {
  await withApp(async ({ post, calls }) => {
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5m0AAAAASUVORK5CYII=';
    assert.equal((await post('/print', { image })).status, 200);
    assert.deepEqual(calls, [image]);
  });
});

test('reject oversized bitmap dimensions before decoding', async () => {
  await withApp(async ({ post, calls }) => {
    const png = Buffer.alloc(24);
    Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
    png.write('IHDR', 12);
    png.writeUInt32BE(100000, 16);
    png.writeUInt32BE(100000, 20);
    assert.equal((await post('/print', { image: `data:image/png;base64,${png.toString('base64')}` })).status, 400);
    assert.equal(calls.length, 0);
  });
});

test('reject invalid tasks, malformed JSON and oversized JSON', async () => {
  await withApp(async ({ base, post }) => {
    for (const task of ['', ' ', 1, null, 'x'.repeat(4001)]) {
      assert.equal((await post('/icon-suggest', { task })).status, 400);
    }
    assert.deepEqual(await (await post('/icon-suggest', { task: ' Buy milk ' })).json(), { icon: 'shopping' });
    assert.equal((await fetch(base + '/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await post('/print', { image: 'x'.repeat(11 * 1024 * 1024) })).status, 413);
  });
});

test('foreign browser origins are rejected; same host behind HTTPS proxy works', async () => {
  await withApp(async ({ base, post }) => {
    assert.equal((await post('/icon-suggest', { task: 'Buy milk' }, { Origin: 'https://other.example' })).status, 403);
    assert.equal((await post('/icon-suggest', { task: 'Buy milk' }, { Origin: base.replace('http:', 'https:') })).status, 200);
  });
});

test('validate audio upload, limit its size and use the processed WebM filename', async () => {
  await withApp(async ({ base }) => {
    assert.equal((await fetch(base + '/whisper', { method: 'POST' })).status, 400);
    const audio = new FormData();
    audio.append('audio', new Blob(['audio'], { type: 'audio/mp4' }), 'input.mp4');
    const result = await fetch(base + '/whisper', { method: 'POST', body: audio });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { text: 'Buy milk' });
    const tooLarge = new FormData();
    tooLarge.append('audio', new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]), 'large.webm');
    assert.equal((await fetch(base + '/whisper', { method: 'POST', body: tooLarge })).status, 413);
  });
});

test('processing errors return safe JSON without leaking internal details', async () => {
  await withApp(async ({ base }) => {
    const audio = new FormData();
    audio.append('audio', new Blob(['bad']), 'bad.webm');
    const result = await fetch(base + '/whisper', { method: 'POST', body: audio });
    assert.equal(result.status, 500);
    assert.deepEqual(await result.json(), { error: 'Request failed. Please try again.' });
  }, { preprocessAudio: async () => { throw new Error('private-file-path'); } });
});
