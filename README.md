# Synapse MVP (Algorithm Walkthrough)

This repo contains the web MVP for Synapse: voice + canvas with step list, code viewer, and output terminal, using the Gemini Live API (API key flow) and a patch-based canvas.

## Quick start
```bash
npm install              # already done on your machine; rerun if deps change
npm run dev             # launches Vite dev server on http://localhost:5173
npm run build           # production build (dist/)
npm run prompt:ci       # prompt harness gate
```

### Env vars
- `.env.local` (already present) should include:
  - `GEMINI_API_KEY=...` (for server-side scripts or Node tools)
  - `VITE_GEMINI_API_KEY=...` (for the browser app Live mode; if omitted, the app runs in mock mode)

### Live connector
- Code in `live_connector/connector.ts` uses the Google Gen AI SDK with the API key.
- `live_connector/replay.ts` supports MOCK (default) and LIVE (`LIVE_REPLAY=1`) modes; LIVE requires network + audio plumbing.

### Prompt harness
- Prompt text: `prompt/v1.0.txt`
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
