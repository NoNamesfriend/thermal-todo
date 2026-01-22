import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import os from "os";

const execAsync = promisify(exec);

const tmpRoot = join(os.tmpdir(), "thermal-todo/audio");

export async function preprocessAudio(buffer) {
  await mkdir(tmpRoot, { recursive: true });

  const ts = Date.now();
  const inPath = join(tmpRoot, `input-${ts}`); // no forced extension, ffmpeg detects format
  const outPath = join(tmpRoot, `output-${ts}.webm`);

  await writeFile(inPath, buffer);

  // Goal: always produce WebM with Opus audio, 16 kHz mono (compatible with Whisper Web/API)
  // -af: remove silence at start/end and normalize loudness
  // -ac 1: mono, -ar 16000: 16 kHz, -c:a libopus: encode Opus in WebM
  const cmd = `ffmpeg -y -hide_banner -loglevel error -i "${inPath}" -af "silenceremove=start_periods=1:start_threshold=-35dB,areverse,silenceremove=start_periods=1:start_threshold=-35dB,areverse,loudnorm" -ac 1 -ar 16000 -c:a libopus -b:a 64k -f webm "${outPath}"`;

  try {
    await execAsync(cmd);
    const processedBuffer = await readFile(outPath);
    return processedBuffer;
  } catch (err) {
    // enrich error with ffmpeg stderr when available
    const message = err.stderr ? `ffmpeg error: ${err.stderr}` : err.message || String(err);
    throw new Error(`Audio preprocessing failed: ${message}`);
  } finally {
    // try to remove temp files; ignore errors during cleanup
    try { await unlink(inPath); } catch (e) {}
    try { await unlink(outPath); } catch (e) {}
  }
}
