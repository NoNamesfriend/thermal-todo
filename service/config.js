import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { cleanEnv, str, makeValidator, port } from 'envalid';

config({
  path: [new URL('./.env', import.meta.url), new URL('../.env', import.meta.url)].map(fileURLToPath),
  quiet: true,
});

const labelWidth = makeValidator(value => {
  const width = Number(value);
  if (!Number.isFinite(width) || width <= 0) throw new Error('Label width must be a positive number');
  return width;
});

export const env = cleanEnv(process.env, {
  // Make OPENAI_API_KEY optional so AI features can be disabled when not set
  OPENAI_API_KEY: str({ default: '' }),
  JEV_API_KEY: str({ default: '' }),
  JEV_MODEL: str({ default: 'jev-latest' }),
  WHISPER_BINARY: str({ default: '/usr/local/bin/whisper-cli' }),
  WHISPER_MODEL_PATH: str({ default: '/opt/whisper/ggml-base.bin' }),
  // Label width in millimeters (common: 58 or 80)
  LABEL_WIDTH_MM: labelWidth({ default: 80 }),
  PORT: port({ default: 3000 }),
  PRINTER_INTERFACE: str({ default: 'usb' }),
  PRINTER_TYPE: str({ default: 'EPSON' }),
});
