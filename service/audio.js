import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);
export async function preprocessAudio(buffer, format = 'webm') {
  if (!['webm', 'wav'].includes(format)) throw new Error('Unsupported audio output format');
  const directory = await mkdtemp(join(tmpdir(), 'thermal-todo-audio-'));
  const input = join(directory, 'input');
  const output = join(directory, `output.${format}`);
  try {
    await writeFile(input, buffer);
    await execFileAsync('ffmpeg', [
      '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
      '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'matroska,webm,mov,mp3,wav,ogg,aac',
      '-t', '10', '-i', input,
      '-af', 'silenceremove=start_periods=1:start_threshold=-35dB,areverse,silenceremove=start_periods=1:start_threshold=-35dB,areverse,loudnorm',
      '-vn', '-ac', '1', '-ar', '16000',
      ...(format === 'wav' ? ['-c:a', 'pcm_s16le', '-f', 'wav'] : ['-c:a', 'libopus', '-b:a', '64k', '-f', 'webm']), output,
    ], { timeout: 5_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024, windowsHide: true });
    return await readFile(output);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
