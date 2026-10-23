import test from 'node:test';
import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createLocalTranscriber } from './local-whisper.js';

test('each local request runs a new bounded CLI invocation and removes its files', async () => {
  const directories = [];
  const transcribe = createLocalTranscriber({
    prepare: async (_, format) => { assert.equal(format, 'wav'); return Buffer.alloc(128); },
    run: async (_, args, options) => {
      const output = args[args.indexOf('-of') + 1];
      directories.push(dirname(output));
      assert.ok(options.timeout > 0 && options.timeout <= 5000);
      assert.equal(options.killSignal, 'SIGKILL');
      await writeFile(`${output}.json`, JSON.stringify({ transcription: [{ text: ' Milch\n' }, { text: ' einkaufen. ' }] }));
    },
  });
  assert.deepEqual(await transcribe(Buffer.from('first')), { text: 'Milch einkaufen.' });
  assert.deepEqual(await transcribe(Buffer.from('second')), { text: 'Milch einkaufen.' });
  assert.equal(directories.length, 2);
  assert.notEqual(directories[0], directories[1]);
  for (const directory of directories) await assert.rejects(access(directory));
});

test('concurrent local requests fail immediately and failures release the single-flight slot', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const transcribe = createLocalTranscriber({ prepare: async () => { await pending; return Buffer.alloc(78); } });
  const first = transcribe(Buffer.alloc(1));
  await assert.rejects(transcribe(Buffer.alloc(1)), { status: 429, code: 'SPEECH_BUSY' });
  release();
  assert.deepEqual(await first, { text: '' });
  assert.deepEqual(await transcribe(Buffer.alloc(1)), { text: '' });
});

test('timeouts kill the CLI, remove temporary files, and allow another request', async () => {
  let directory;
  const transcribe = createLocalTranscriber({ prepare: async () => Buffer.alloc(128), run: async (_, args) => {
    directory = dirname(args[args.indexOf('-of') + 1]);
    throw Object.assign(new Error('private path'), { killed: true });
  } });
  for (let i = 0; i < 2; i++) {
    await assert.rejects(transcribe(Buffer.alloc(1)), { status: 504, code: 'SPEECH_TIMEOUT' });
    await assert.rejects(access(directory));
  }
});
