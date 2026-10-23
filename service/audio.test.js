import test from 'node:test';
import assert from 'node:assert/strict';
import { preprocessAudio } from './audio.js';

function tone() {
  const samples = 16000;
  const data = Buffer.alloc(44 + samples * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(16000, 24); data.writeUInt32LE(32000, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin(i * Math.PI * 880 / 16000) * 8000), 44 + i * 2);
  return data;
}
test('concurrent audio preprocessing produces independent WebM files', async () => {
  const result = await Promise.all([preprocessAudio(tone()), preprocessAudio(tone())]);
  for (const buffer of result) {
    assert.ok(buffer.length > 1500);
    assert.equal(buffer.subarray(0, 4).toString('hex'), '1a45dfa3');
  }
});
test('invalid audio fails without returning an output file', async () => {
  await assert.rejects(preprocessAudio(Buffer.from('invalid audio')));
});

test('local preprocessing outputs 16 kHz mono PCM WAV and preserves the existing WebM path', async () => {
  const wav = await preprocessAudio(tone(), 'wav');
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 16000);
  await assert.rejects(preprocessAudio(tone(), 'unsupported'));
});
