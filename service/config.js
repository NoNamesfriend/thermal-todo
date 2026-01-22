import 'dotenv/config';
import { cleanEnv, str, num } from 'envalid';

export const env = cleanEnv(process.env, {
  // Make OPENAI_API_KEY optional so AI features can be disabled when not set
  OPENAI_API_KEY: str({ default: '' }),
  PRINTER_INTERFACE: str({ default: 'usb' }),
  PRINTER_TYPE: str({ default: 'EPSON' }),
});
