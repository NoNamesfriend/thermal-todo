import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { printImage } from './printer.js';
import { preprocessAudio } from './audio.js';
import { suggestIcon, transcribeAudio } from './ai.js';
import { env } from './config.js';
import { getSpeechCapabilities, transcribeLocalAudio, SpeechError } from './local-whisper.js';
import { getIconCapabilities, ICON_PROVIDERS, IconError } from './icon-provider.js';

export function createApp(dependencies = {}) {
  const services = { printImage, preprocessAudio, suggestIcon, transcribeAudio, getSpeechCapabilities, transcribeLocalAudio, getIconCapabilities, ...dependencies };
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.get('host')) throw new Error('Foreign origin');
      } catch {
        return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
      }
    }
    next();
  });
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(fileURLToPath(new URL('./public/', import.meta.url))));
  app.post('/print', async (req, res) => {
    const image = req.body?.image;
    if (typeof image !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) {
      return res.status(400).json({ error: 'A base64 PNG image is required.' });
    }
    const png = Buffer.from(image.slice('data:image/png;base64,'.length), 'base64');
    // Bound dimensions before the printer library allocates a bitmap.
    if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        png.toString('ascii', 12, 16) !== 'IHDR' || !png.readUInt32BE(16) || !png.readUInt32BE(20) ||
        png.readUInt32BE(16) > 2048 || png.readUInt32BE(20) > 16384 ||
        png.readUInt32BE(16) * png.readUInt32BE(20) > 8_000_000) {
      return res.status(400).json({ error: 'Invalid PNG or image dimensions exceed the print limit.' });
    }
    await services.printImage(image);
    res.json({ status: 'ok' });
  });
  app.post('/icon-suggest', async (req, res) => {
    const task = req.body?.task;
    if (typeof task !== 'string' || !task.trim() || task.length > 4000) {
      return res.status(400).json({ error: 'Task must contain between 1 and 4000 characters.' });
    }
    const icons = services.getIconCapabilities();
    const provider = req.body.provider ?? icons.defaultProvider;
    if (!ICON_PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Choose a supported icon provider.' });
    if (!icons[provider]) return res.status(503).json({ error: 'Selected icon provider is unavailable.' });
    if (provider === 'none') return res.json({ icon: 'other' });
    res.json(await services.suggestIcon(task.trim(), provider));
  });
  const upload = multer({ limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 } });
  app.post('/whisper', async (req, res, next) => {
    const speech = await services.getSpeechCapabilities();
    const provider = req.query.provider ?? speech.defaultProvider;
    if (!provider) return res.status(503).json({ error: 'No speech provider is available.' });
    if (!['local', 'openai'].includes(provider)) return res.status(400).json({ error: 'Choose a supported speech provider.' });
    if (!speech[provider]) return res.status(503).json({ error: 'Selected speech provider is unavailable.' });
    req.speechProvider = provider;
    next();
  }, upload.single('audio'), async (req, res) => {
    if (!req.file?.buffer.length) return res.status(400).json({ error: 'An audio file is required.' });
    let transcription;
    if (req.speechProvider === 'local') {
      transcription = await services.transcribeLocalAudio(req.file.buffer);
    } else {
      const cleanBuffer = await services.preprocessAudio(req.file.buffer);
      if (!cleanBuffer || cleanBuffer.length < 1500) {
        return res.status(400).json({ error: 'Audio contains no speech or is too short after preprocessing.' });
      }
      transcription = await services.transcribeAudio(cleanBuffer, 'audio.webm');
    }
    res.json({ text: (transcription.text || '').trim().replace(/[.!?]+$/, '') });
  });
  app.get('/config', async (req, res) => {
    const icons = services.getIconCapabilities();
    res.json({ ai: icons.mini || icons.jev, labelWidthMm: env.LABEL_WIDTH_MM,
      icons, speech: await services.getSpeechCapabilities() });
  });
  app.get('/health', (req, res) => res.sendStatus(200));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof SpeechError || error instanceof IconError) {
      if (error.status === 429) res.set('Retry-After', '1');
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    if (error instanceof multer.MulterError) {
      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'Invalid audio upload or upload limit exceeded.' });
    }
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    console.error(`${req.method} ${req.path} failed:`, error);
    res.status(500).json({ error: 'Request failed. Please try again.' });
  });
  return app;
}
