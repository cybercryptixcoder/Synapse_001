# Live Connector (Legacy Developer API flow)

This directory contains:
- `connector.ts` — builds the Live config and opens a Gemini Live session using the **API key** path of the Google Gen AI SDK (not Vertex). Kept for replay tooling.
- `replay.ts` — harness entry:
  - MOCK mode (default): replays the sample JSONL log and runs the prompt harness.
  - LIVE mode: `LIVE_REPLAY=1 node dist/live_connector/replay.js` (after build) attempts a real Live session; currently stubbed to open/close without audio.

## Setup
1) Add the SDK deps:
```bash
npm install
```
2) Ensure `.env` or `.env.local` exists with:
```
GEMINI_API_KEY=...your key...
# or
VITE_GEMINI_API_KEY=...your key...
```

## Scripts
- `npm run prompt:ci` — runs prompt harness (golden validation + sample log).
- `npm run live:replay` — ts-node replay (MOCK by default). Set `LIVE_REPLAY=1` for live attempt.

## Notes
- The app itself now uses the Vertex Live proxy in `server/token-server.ts`.
- LIVE replay still requires outbound network access; MOCK mode is CI-safe.
- Audio ingestion/emission is intentionally stubbed; wire your audio transport to `sendAudio` and `onAudio` callbacks.
