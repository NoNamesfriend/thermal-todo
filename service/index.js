import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import path from "path";
import { printImage } from "./printer.js";
import { preprocessAudio } from "./audio.js";
import { suggestIcon, transcribeAudio } from "./ai.js";
import { env } from "./config.js";

const app = express();
app.use(cors());

// Basic Content Security Policy to allow common resources (images, data URIs, https)
// Adjust as needed for stricter policies in production or to match a reverse proxy.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; font-src 'self' data:"
  );
  next();
});
app.use(bodyParser.json({ limit: "10mb" }));

// Serve built frontend (copied into ./public by the Dockerfile)
app.use(express.static(path.join(process.cwd(), "public")));

app.post("/print", async (req, res) => {
  try {
    const { image } = req.body;
    await printImage(image);
    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/icon-suggest", async (req, res) => {
  const { task } = req.body;
  const result = await suggestIcon(task);
  res.json(result);
});

const upload = multer();

app.post("/whisper", upload.single("audio"), async (req, res) => {
  try {
    const cleanBuffer = await preprocessAudio(req.file.buffer);

    // If preprocessing produced an empty or extremely small file, return a clear error
    if (!cleanBuffer || cleanBuffer.length < 1500) {
      console.warn("Processed audio is empty or too small; skipping transcription.");
      return res.status(400).json({ error: "Audio contains no speech or is too short after preprocessing." });
    }

    const transcription = await transcribeAudio(cleanBuffer, req.file.originalname);

    const cleanedText = (transcription.text || "").replace(/[.!?]+$/, "");

    res.json({ text: cleanedText });
  } catch (err) {
    console.error("/whisper error:", err);
    // If the error originates from the OpenAI client, pass a safe message
    res.status(500).json({ error: err.message || "Transcription failed" });
  }
});

app.get('/config', (req, res) => {
  // Expose whether AI features are enabled (based on presence of OPENAI_API_KEY)
  res.json({ ai: !!env.OPENAI_API_KEY, labelWidthMm: env.LABEL_WIDTH_MM });
});

// Fallback: serve index.html for any other GET so SPA routes work when deployed
app.get('*', (req, res) => {
  const indexPath = path.join(process.cwd(), 'public', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(404).send('Not found');
    }
  });
});

app.listen(3000, '0.0.0.0', () => {
  console.log(`Service running at http://0.0.0.0:3000`);
});
