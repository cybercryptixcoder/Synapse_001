# Gemini Live Voice Agent

Real-time bidirectional voice interaction with Google's Gemini Live API using `@google/genai`.

## Features

- **Voice-in / Voice-out** — Speak naturally and hear the AI respond
- **Barge-in** — Interrupt the AI mid-sentence and it stops immediately
- **Async audio pipeline** — Microphone capture, WebSocket streaming, and speaker playback run concurrently without blocking

## Setup

```bash
cd gemini-live-app
npm install
npm run dev
```

Open the app in Chrome, enter your Gemini API key, and click **Connect & Talk**.

## Architecture

| File | Purpose |
|---|---|
| `src/lib/gemini-client.ts` | Manages the Live API WebSocket session, sends mic audio, receives model audio |
| `src/lib/audio-utils.ts` | PCM ↔ base64 conversion, scheduled audio playback with barge-in support |
| `src/App.tsx` | React UI — mic capture, status display, log panel |
| `src/index.css` | Dark glassmorphism design system |

## Requirements

- `@google/genai` (v1.44+)
- A valid [Gemini API key](https://aistudio.google.com/apikey)
- Chrome or Edge (for `AudioContext` and `getUserMedia`)
