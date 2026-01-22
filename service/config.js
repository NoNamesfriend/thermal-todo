import 'dotenv/config';
import { cleanEnv, str, num } from 'envalid';

export const env = cleanEnv(process.env, {
  OPENAI_API_KEY: str(),
  PRINTER_INTERFACE: str({ default: 'usb' }),
  PRINTER_TYPE: str({ default: 'EPSON' }),
});
