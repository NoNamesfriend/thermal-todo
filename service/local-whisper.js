import { access, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { preprocessAudio } from './audio.js';
import { env } from './config.js';

const execFileAsync = promisify(execFile);

export class SpeechError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function getSpeechCapabilities() {
  const local = await Promise.all([
    access(env.WHISPER_BINARY, constants.X_OK), access(env.WHISPER_MODEL_PATH, constants.R_OK),
  ]).then(() => true, () => false);
  const openai = !!env.OPENAI_API_KEY;
  return { local, openai, defaultProvider: local ? 'local' : openai ? 'openai' : null };
}

// One child per request. No resident model, no waiting queue, no automatic cloud fallback.
export function createLocalTranscriber({ run = execFileAsync, prepare = preprocessAudio,
  binary = env.WHISPER_BINARY, model = env.WHISPER_MODEL_PATH } = {}) {
  let busy = false;
  return async buffer => {
    if (busy) throw new SpeechError('Speech recognition is busy. Please try again.', 429, 'SPEECH_BUSY');
    busy = true;
    let directory;
    try {
      const started = performance.now();
      const wav = await prepare(buffer, 'wav');
      if (wav.length < 100) return { text: '' };
      directory = await mkdtemp(join(tmpdir(), 'thermal-todo-whisper-'));
      const input = join(directory, 'audio.wav');
      const output = join(directory, 'result');
      await writeFile(input, wav);
      const remaining = 5_000 - Math.ceil(performance.now() - started);
      if (remaining <= 0) throw new SpeechError('Local recognition exceeded its time limit.', 504, 'SPEECH_TIMEOUT');
      await run(binary, ['-m', model, '-f', input, '-l', 'de', '-t', '2', '-ng',
        '-bs', '1', '-bo', '1', '-nt', '-oj', '-of', output], {
        timeout: remaining, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024, windowsHide: true,
      });
      const result = JSON.parse(await readFile(`${output}.json`, 'utf8'));
      if (!Array.isArray(result.transcription) || result.transcription.some(segment => typeof segment.text !== 'string')) {
        throw new Error('Invalid local transcription result');
      }
      return { text: result.transcription.map(segment => segment.text).join(' ').replace(/\s+/g, ' ').trim() };
    } catch (error) {
      if (error.killed || error.code === 'ETIMEDOUT') {
        throw new SpeechError('Local recognition exceeded its time limit.', 504, 'SPEECH_TIMEOUT');
      }
      throw error;
    } finally {
      try {
        if (directory) await rm(directory, { recursive: true, force: true });
      } finally { busy = false; }
    }
  };
}

export const transcribeLocalAudio = createLocalTranscriber();
