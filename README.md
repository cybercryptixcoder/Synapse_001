# Synapse MVP (Algorithm Walkthrough)

This repo contains the web MVP for Synapse: voice + canvas with step list, code viewer, and output terminal, using the Vertex AI Live API (proxy flow) and a patch-based canvas.

## Quick start
```bash
npm install              # already done on your machine; rerun if deps change
npm run dev             # launches Vite dev server on http://localhost:5173
npm run build           # production build (dist/)
npm run prompt:ci       # prompt harness gate
npx tsx server/token-server.ts  # starts the Vertex Live proxy on http://localhost:3001
```

### Env vars
- `.env` or `.env.local` (already present) should include:
  - `VITE_API_MODE=vertex` (set to `api` for Developer API key mode)
  - `VITE_GCP_PROJECT_ID=...` (GCP project id for Vertex Live)
  - `VITE_GCP_LOCATION=us-central1` (region; default is `us-central1`)
  - `VITE_VERTEX_MODEL=gemini-live-2.5-flash-preview-native-audio-09-2025` (optional override)
  - `VITE_GEMINI_API_VERSION=v1` (optional override; used by the Vertex SDK)
  - `SERVICE_ACCOUNT_KEY_PATH=...` (optional override for the service account JSON path)
  - `TOKEN_SERVER_PORT=3001` (optional override for the proxy port)
  - `VITE_GEMINI_API_KEY=...` (only required when `VITE_API_MODE=api`)
  - `VITE_FORCE_MOCK=true` (optional) to force mock mode
  - `VITE_VERTEX_PROXY_URL=ws://localhost:3001/api/live` (optional explicit proxy URL)
  - If you change `TOKEN_SERVER_PORT`, set `VITE_VERTEX_PROXY_URL` so the browser points at the right port

### SDK
- Live uses `@google/genai` (not the deprecated `@google/generative-ai`) on the server-side proxy. Run `npm install` after pulling to update `node_modules` and `package-lock.json`.

### Live connector
- The browser connects to the local Vertex Live proxy at `ws://localhost:3001/api/live`.
- The proxy is implemented in `server/token-server.ts` and uses `@google/genai` with Vertex auth.
- `live_connector/replay.ts` still supports MOCK (default) and LIVE (`LIVE_REPLAY=1`) modes for prompt harness replays.

### Prompt harness
- Prompt text: `prompt/v1.1.txt`
- Harness: `prompt/harness/run_harness.py`
- CI helper: `prompt/harness/ci.sh`

## App structure
- `src/canvas` — types, reducer, provider for canvas state and patches.
- `src/components` — StepList, CodeViewer, OutputTerminal, TextNote, FloatingInput, CanvasView.
- `src/hooks` — worker runner (JS exec), live session stub (mock/live).
- `src/worker` — `codeRunner.ts` sandbox with 2s timeout.
- `src/mock` — mock patches for the demo flow.

## Export
- In the app header, click **Export** to download the current `canvasState` as JSON.

## Notes
- Snapshot bursts and mic/audio piping are stubbed; add your media pipeline and hook `request_snapshot_burst` as needed.
- Reconnect tokens and Live events are surfaced via `useLiveSession`; logic can be extended when network access is available.
