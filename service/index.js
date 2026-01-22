import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import { printImage } from "./printer.js";
import { preprocessAudio } from "./audio.js";
import { suggestIcon, transcribeAudio } from "./ai.js";
import { env } from "./config.js";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

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

app.listen(3000, '0.0.0.0', () => {
  console.log(`Service running at http://0.0.0.0:${3000}`);
});

app.get('/config', (req, res) => {
  // Expose whether AI features are enabled (based on presence of OPENAI_API_KEY)
  res.json({ ai: !!env.OPENAI_API_KEY });
});