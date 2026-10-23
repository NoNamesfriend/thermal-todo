![Project Logo](assets/logo_background_dark.svg)

Thermal ToDo is a small app that records short voice notes, transcribes them using AI, and prints receipts or notes via a connected thermal printer.

This repository contains two parts:

- `frontend` — Svelte app (Vite)
- `service` — Express API (Node)

Three common workflows are described below: running with Docker, Docker Compose (recommended) and local development with hot reload.

## Run with Docker

The project includes a multi-stage `Dockerfile` that builds the frontend, installs service dependencies, installs system `ffmpeg`, copies the built frontend into the service `public/` folder and runs the Node service which serves both the frontend and API on a single port (default `3000`).

Build the image and run it:

```bash
# download Dockerfile
git clone https://github.com/NoNamesfriend/thermal-todo.git
cd thermal-todo


# build image (from repo root)
cp .env.example .env
docker build -t thermal-todo:latest .

# run
docker run --rm --name thermal-todo -p 3000:3000 --env-file .env thermal-todo:latest

# then open http://localhost:3000 on your desktop or http://<host-ip>:3000 on your phone
```

Notes for Docker setup:

- The container installs system `ffmpeg` (so the app uses the system binary `ffmpeg`).
- The Express service listens on `0.0.0.0:3000` and serves the built frontend from `/public`.

## Run with Docker Compose

This repo includes a `docker-compose.yml` that builds the image and runs the app container.

Quick start:

```bash
# download docker-compose.yml
git clone https://github.com/NoNamesfriend/thermal-todo.git
cd thermal-todo
cp .env.example .env

# build and start detached
docker compose up -d --build

# follow logs
docker compose logs -f

# stop
docker compose down
```

## Environment Variables

The application uses several environment variables (can be set in a `.env` file at the project root). Below are the most important variables with description and default/example values:

```bash
curl -fsSL https://raw.githubusercontent.com/NoNamesfriend/thermal-todo/refs/heads/master/.env.example -o .env
```

| Variable            | Description                                                                                                 | Default | Required |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ------: | :------: |
| `PRINTER_TYPE`      | Printer type for `node-thermal-printer` (e.g. `EPSON`)                                                      | `EPSON` |    No    |
| `PRINTER_INTERFACE` | Printer device or network interface (e.g. `usb` or `tcp://...`)                                             |   `usb` |    No    |
| `LABEL_WIDTH_MM`    | Label width in millimeters used for on-screen preview and print layout (common: `80` or `58`)               |    `80` |    No    |
| `OPENAI_API_KEY`    | Enables OpenAI transcription and task icon suggestions. Local speech recognition works without a key in the Docker image. |       — |    No    |
| `JEV_API_KEY` | TypeSafe API token for Jev icon classification. | — | No |
| `JEV_MODEL` | TypeSafe model name or alias, optionally pinned to a version available to the account. | `jev-latest` | No |
| `WHISPER_BINARY` | Local whisper.cpp CLI executable (included in Docker). | `/usr/local/bin/whisper-cli` | No |
| `WHISPER_MODEL_PATH` | Local multilingual base model (included in Docker). | `/opt/whisper/ggml-base.bin` | No |

## Local development

Use this workflow if you want fast edit-reload cycles and to run frontend and service separately on your machine.

Prerequisites

- Node.js 24.22.1 LTS or a newer patched 24.x version (see `.node-version`)
- npm
- ffmpeg (system installation) — required by the service for audio preprocessing. See the official installation guide for your platform:
  - ffmpeg downloads/instructions: https://ffmpeg.org/download.html

Install & start both parts from the repo root:

```bash
# install deps for both
npm install
npm install --prefix frontend
npm install --prefix service

# start frontend dev server (Vite)
npm run dev --prefix frontend

# in a second shell: start service with nodemon
npm run dev --prefix service
```

Open the frontend at the Vite dev URL (usually `https://localhost:5173`) and the API at `http://localhost:3000`.

The development frontend uses HTTPS (`https://localhost:5173`) so microphone
access also works on supported devices after accepting the local certificate.
On a LAN, production voice input requires HTTPS through a reverse proxy.
Typing and printing do not require microphone access or an OpenAI key.

The Docker image includes CPU-only whisper.cpp and the multilingual base model.
Local recognition starts a new CLI process for each recording and exits after it
finishes; no model server stays resident. Audio preprocessing and inference share
a five-second execution budget. Only one local recognition runs at a time; an
additional request receives HTTP 429 so it can be retried. Audio is capped at
ten seconds and temporary files are removed on success, failure, or timeout.

Open **Settings → Speech recognition** to select **Local (Whisper base)** or
**OpenAI Whisper**. Local is the default when available. OpenAI requires a
server-side `OPENAI_API_KEY`; the browser receives only its availability, never
the key. The choice is stored per browser. A failed local request stays local;
audio is never automatically sent to OpenAI. Icon recognition is configured independently under **Settings → Icon recognition**.
Choose GPT-4.1 mini, GPT-6 Luna, Jev (TypeSafe), or no icon recognition.
Both GPT models use `OPENAI_API_KEY`; Jev uses its own server-side `JEV_API_KEY`.
Jev is the default when its token is configured, including when an OpenAI key is
also present. Without a Jev token, GPT-4.1 mini is selected if configured;
otherwise icon recognition is off. Existing browser preferences take precedence.
An unavailable saved selection is preserved without silently using another provider. For non-Docker development, build the
pinned whisper.cpp revision documented in `docs/local-ai/models.json` and set
`WHISPER_BINARY` and `WHISPER_MODEL_PATH` to the executable and verified base
model paths. Without these files, the dialog marks local recognition unavailable.

The normal GitHub workflow builds and publishes this complete image to GHCR;
there is no separate model download or AI container to configure at runtime.
The five-second measurement covers processing on the tested Ryzen server.
Uploads, browser rendering, and later icon suggestions add their own latency.

Node 24.22.1 includes the [October 21, 2026 security fixes](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).
All Docker stages pin this version. The package engines require a patched 24.x
runtime; this repository does not update your system-wide Node installation.

Run `npm run build` and `npm test` from the repository root to check the frontend,
API validation, and concurrent FFmpeg preprocessing. Tests use synthetic audio
and stub AI/printer services; they send no OpenAI requests or print jobs. FFmpeg
must be on `PATH` for the audio tests. Check dependencies with `npm audit` in the
root, `frontend`, and `service` directories.

The service defaults to port 3000 (`PORT` can override it outside Compose).
Label width must be positive (common values are 58 and 80 mm); the default is 80 mm. Uploads are limited
to 5 MiB and preprocessing to 10 seconds. Keep the unauthenticated service on a
trusted network or protect it with your reverse proxy. The proxy must preserve
the browser's Host header for same-origin API requests.

## Local AI feasibility

The [Unraid evaluation](docs/local-ai/README.md) records measured Julia 1
classification results, local Whisper latency, memory use, and reproducible test
scripts. The application now supports the measured local Whisper base path and
optional OpenAI transcription; icon recognition supports OpenAI and TypeSafe Jev.

## Icon provider credentials

For local development and comparison tests, put `JEV_API_KEY=your_typesafe_token`
in the repository-root `.env` file. Keep the existing `OPENAI_API_KEY` for both
GPT-4.1 mini and GPT-6 Luna. Preserve other settings already present in that file.
The service reads `service/.env` first and the repository-root `.env` second;
existing process environment variables take precedence. Avoid duplicate key
settings in both files. Tests set their own fake keys and do not use live keys.

On Unraid, edit the Thermal-ToDo container and add an environment variable with
key `JEV_API_KEY` and the TypeSafe token as its value, then apply the change.
For Docker Compose, put the token in `.env` beside `docker-compose.yml` and
recreate the container after changing it (`docker compose up -d`). Compose
forwards `JEV_API_KEY` and optional `JEV_MODEL` at runtime. These credentials
are never build arguments or frontend settings. Root and nested `.env` files
are excluded from Git and the Docker build context.

Jev calls the official TypeSafe `POST https://api.typesafe.ai/v1/systemone`
endpoint with a native `choice` question containing the existing 20 icon keys.
GPT-6 Luna uses `reasoning_effort: none`; both OpenAI models use a strict JSON
schema limited to those keys. Providers have bounded request timeouts and no
automatic cross-provider fallback. A token's presence makes an option available;
it does not prove the token has credit, model access, or valid permissions.

The comparison helper `scripts/local-ai/benchmark_icons.mjs` sends the synthetic
German fixture tasks to the selected live providers and writes timing, accuracy,
and reported token usage without saving keys. Run it only when you intend to use
the corresponding API accounts:

```bash
node scripts/local-ai/benchmark_icons.mjs --providers mini,luna,jev
```

Use `--limit 5` for a short smoke test. The default uses the 65 existing cases;
60 clear cases and five ambiguous cases are scored separately. Results are saved
under `docs/local-ai/icon-comparison.json`. No comparison is run automatically
when the application starts or when settings are opened.
