/**
 * Live connector for Gemini Live over the Google Gen AI SDK (API key variant, not Vertex).
 *
 * Responsibilities:
 * - Build the Live configuration (same as Vertex: contextWindowCompression, sessionResumption, tools).
 * - Open a Live session using an API key.
 * - Surface audio and tool events to the app, and allow sending audio/tool results back.
 *
 * NOTE: This is meant to be used inside the web/Node sidecar that proxies audio/WebSocket.
 * It does not handle device capture; it focuses on session lifecycle and config.
 */

// Install dependency:
//   npm install

import { GoogleGenerativeAI, LiveConnectConfig, FunctionCallingConfig } from "@google/generative-ai";

type Patch = Record<string, unknown>;

export type LiveSession = {
  sendAudio: (chunk: ArrayBuffer) => void;
  close: () => Promise<void>;
};

export type LiveCallbacks = {
  onAudio: (pcm16: ArrayBuffer) => void;
  onToolCall: (toolName: string, args: unknown) => void;
  onClose: (reason?: string) => void;
};

/**
 * Build the Live config object used for setup and resume.
 */
export function buildLiveConfig(): LiveConnectConfig {
  const tools = [
    {
      name: "emit_canvas_patches",
      description: "Apply one or more canvas patches; never generate UI code.",
      parameters: {
        type: "object",
        properties: {
          patches: { type: "array", items: { type: "object" } },
        },
        required: ["patches"],
      },
    },
    {
      name: "request_snapshot_burst",
      description: "Ask client for low-FPS screen snapshots when you need visual confirmation.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
          duration_s: { type: "integer", default: 8 },
          fps: { type: "number", default: 1.0 },
        },
        required: ["reason"],
      },
    },
  ];

  const functionCalling: FunctionCallingConfig = "AUTO";

  return {
    responseModalities: ["AUDIO"],
    model: "gemini-2.5-flash-native-audio-preview",
    contextWindowCompression: {
      slidingWindow: { triggerTokens: 0.75 * 128_000, targetTokens: 0.6 * 128_000 },
    },
    sessionResumption: {},
    functionCallingConfig: functionCalling,
    tools,
    turnCoverage: { automatic: { activityOnly: true } },
    mediaResolution: "LOW",
    temperature: { voice: 0.6, tools: 0.2 },
  };
}

/**
 * Create a Live session using the API key (non-Vertex).
 */
export async function createLiveSession(
  apiKey: string,
  callbacks: LiveCallbacks,
): Promise<LiveSession> {
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const genAI = new GoogleGenerativeAI(apiKey);
  const live = await genAI.connectLive({
    config: buildLiveConfig(),
  });

  // Wire event listeners
  live.on("audio", (evt) => {
    callbacks.onAudio(evt.data);
  });

  live.on("tool-call", (evt) => {
    const { name, arguments: args } = evt;
    callbacks.onToolCall(name, args);
  });

  live.on("close", (evt) => {
    callbacks.onClose(evt?.reason);
  });

  return {
    sendAudio: (chunk: ArrayBuffer) => {
      live.sendAudio(chunk);
    },
    close: async () => {
      await live.close();
    },
  };
}

/**
 * Helper for formatting patches as a tool result the model expects.
 */
export function formatPatches(patches: Patch[]) {
  return { name: "emit_canvas_patches", output: { patches } };
}
