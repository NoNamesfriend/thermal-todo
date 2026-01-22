# Thermal ToDo

This repository contains two parts:

- `frontend` — Svelte app (Vite)
- `service` — Express API (Node)

Three common workflows are described below: running with Docker, Docker Compose (recommended) and local development with hot reload.

---

## Run with Docker

The project includes a multi-stage `Dockerfile` that builds the frontend, installs service dependencies, installs system `ffmpeg`, copies the built frontend into the service `public/` folder and runs the Node service which serves both the frontend and API on a single port (default `3000`).

Build the image and run it:

```bash
# build image (from repo root)
docker build -t thermal-todo:latest .

# run
docker run -e OPENAI_API_KEY="sk-..." -p 31234:3000 --rm --name thermal-todo thermal-todo:latest

# then open http://localhost:31234 on your desktop or http://<host-ip>:31234 on your phone
```

Notes for Docker setup:

- The container installs system `ffmpeg` (so the app uses the system binary `ffmpeg`).
- The Express service listens on `0.0.0.0:3000` and serves the built frontend from `/public`.

---

## Run with Docker Compose

This repo includes a `docker-compose.yml` that builds the image and runs the app container.

Quick start:

```bash
# build and start detached
docker compose up -d --build

# follow logs
docker compose logs -f

# stop
docker compose down
```

Access the app via `http://<host-ip>:${HOST_PORT}` after the compose stack is up.

## Environment Variables

The application uses several environment variables (can be set in a `.env` file at the project root). Below are the most important variables with description and default/example values:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/.env.example -o .env
```

| Variable            | Description                                                                             | Default | Required |
| ------------------- | --------------------------------------------------------------------------------------- | ------: | :------: |
| `HOST_PORT`         | Host port mapped to the container by `docker compose` (frontend reachable on this port) | `31234` |    No    |
| `OPENAI_API_KEY`    | OpenAI API key used for transcription / AI calls                                        |       — |   Yes    |
| `PRINTER_TYPE`      | Printer type for `node-thermal-printer` (e.g. `EPSON`)                                  | `EPSON` |    No    |
| `PRINTER_INTERFACE` | Printer device or network interface (e.g. `usb` or `tcp://...`)                         |   `usb` |    No    |

## Local development

Use this workflow if you want fast edit-reload cycles and to run frontend and service separately on your machine.

Prerequisites

- Node.js (recommend >= 20.19)
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

Open the frontend at the Vite dev URL (usually `http://localhost:5173`) and the API at `http://localhost:3000`.

If you test from another device (phone on the same LAN), open the frontend using your machine IP and ensure the service is reachable from that IP/port. The app builds API base from the host that served the frontend, so accessing the frontend by host IP lets the frontend call the service at `http://<host-ip>:3000`.

---

## Troubleshooting

- If the frontend cannot reach the API from a phone: check your firewall and confirm you used the host IP when opening the frontend on the device.

---
