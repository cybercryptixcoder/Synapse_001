# Live Connector (Gemini API key flow)

This directory contains:
- `connector.ts` — builds the Live config (context window compression, session resumption, tools) and opens a Gemini Live session using the **API key** path of the Google Gen AI SDK (not Vertex).
- `replay.ts` — harness entry:
  - MOCK mode (default): replays the sample JSONL log and runs the prompt harness.
  - LIVE mode: `LIVE_REPLAY=1 node dist/live_connector/replay.js` (after build) attempts a real Live session; currently stubbed to open/close without audio.

## Setup
1) Add the SDK deps:
```bash
npm install
```
2) Ensure `.env.local` exists with:
```
GEMINI_API_KEY=...your key...
```

## Scripts
- `npm run prompt:ci` — runs prompt harness (golden validation + sample log).
- `npm run live:replay` — ts-node replay (MOCK by default). Set `LIVE_REPLAY=1` for live attempt.

## Notes
- The Live config mirrors the system prompt: two tools, AUTO function calling, sliding-window compression, session resumption, activity-only turn coverage, LOW media resolution.
- LIVE mode will require outbound network access; MOCK mode is CI-safe.
- Audio ingestion/emission is intentionally stubbed; wire your audio transport to `sendAudio` and `onAudio` callbacks.
