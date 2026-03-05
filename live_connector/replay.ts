/**
 * Live replay helper.
 *
 * Modes:
 * - MOCK (default): writes the sample session log and runs the prompt harness against it.
 * - LIVE (set LIVE_REPLAY=1): opens a real Gemini Live session using the API key from .env.local.
 *
 * Note: Network access may be blocked in some environments. LIVE mode will fail without outbound
 * access. MOCK mode is safe everywhere.
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import dotenv from "dotenv";
import { buildLiveConfig, createLiveSession } from "./connector";

const root = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });

const apiKey = process.env.GEMINI_API_KEY || "";
const liveMode = process.env.LIVE_REPLAY === "1";

async function runMock() {
  const logPath = path.join(root, "prompt/harness/artifacts/sample_merge_sort_session.jsonl");
  const harness = path.join(root, "prompt/harness/run_harness.py");
  console.log("Running prompt harness in MOCK mode...");
  const result = spawnSync("python3", [harness, "--session", logPath, "--golden", "merge_sort_walkthrough"], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  console.log("MOCK replay completed.");
}

async function runLive() {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in .env.local");
  }
  console.log("Starting LIVE replay (short scripted dialogue)...");

  const session = await createLiveSession(apiKey, {
    onAudio: (_pcm) => {
      /* TODO: play or store audio */
    },
    onToolCall: (name, args) => {
      console.log("Tool call ->", name, JSON.stringify(args));
    },
    onClose: (reason) => {
      console.log("Live session closed", reason ? `(${reason})` : "");
    },
  });

  // TODO: send real audio. For now, just close immediately after opening.
  await session.close();
  console.log("LIVE replay finished (no audio sent; stub only).");
}

async function main() {
  if (liveMode) {
    await runLive();
  } else {
    await runMock();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
