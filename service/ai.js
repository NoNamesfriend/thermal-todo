import OpenAI from "openai";
import { Readable } from "stream";
import { env } from "./config.js";
import { createIconSuggester } from './icon-provider.js';

let openai;
if (env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
} else {
  openai = null;
}

export const suggestIcon = createIconSuggester({ openai });
export const evaluateIcon = createIconSuggester({ openai, includeMetadata: true });

export async function transcribeAudio(audioBuffer, originalName = "audio.webm") {
  if (!openai) throw new Error('OpenAI API key not configured');
    const stream = Readable.from(audioBuffer);
    stream.path = originalName; // Whisper benötigt einen Dateinamen

    const transcription = await openai.audio.transcriptions.create({
    file: stream,
    model: "whisper-1",
    language: "de",
  });

  return transcription;
}
