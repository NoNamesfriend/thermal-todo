import 'dotenv/config';
import OpenAI from "openai";
import { Readable } from "stream";
import { ICONS } from "./icons.js";
import { env } from "./config.js";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function suggestIcon(task) {
  const iconList = Object.entries(ICONS)
    .map(([key, desc]) => `- ${key}: ${desc}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
Du bist ein Klassifikator.
Wähle genau EIN Icon aus der Liste.
Antworte ausschließlich als JSON.
`,
      },
      {
        role: "user",
        content: `
Aufgabe: "${task}"

Verfügbare Icons:
${iconList}

Antwortformat:
{ "icon": "<icon-key>" }
`,
      },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

export async function transcribeAudio(audioBuffer, originalName = "audio.webm") {
    const stream = Readable.from(audioBuffer);
    stream.path = originalName; // Whisper benötigt einen Dateinamen

    const transcription = await openai.audio.transcriptions.create({
    file: stream,
    model: "whisper-1",
    language: "de",
  });

  return transcription;
}