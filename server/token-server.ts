/**
 * Vertex Live proxy + token server.
 * - WebSocket proxy at /api/live (browser connects here).
 * - Token endpoint at /api/token (optional, for debugging).
 *
 * Usage: npx tsx server/token-server.ts
 */
import express from "express";
import cors from "cors";
import { GoogleAuth } from "google-auth-library";
import path from "path";
import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { LiveServerMessage, FunctionCall } from "@google/genai";
import dotenv from "dotenv";

const projectRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, ".env.local"), override: true });

const PORT = parseInt(process.env.TOKEN_SERVER_PORT || "3001", 10);
const LIVE_WS_PATH = process.env.LIVE_WS_PATH || "/api/live";

// Resolve service account key path — look for any *.json service account file
// in the project root, or use the SERVICE_ACCOUNT_KEY_PATH env var.
const keyFilePath =
  process.env.SERVICE_ACCOUNT_KEY_PATH ||
  path.join(projectRoot, "synapse-489819-990950fad31f.json");

const vertexProjectId =
  process.env.VERTEX_PROJECT_ID ||
  process.env.VITE_GCP_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "";
const vertexLocation =
  process.env.VERTEX_LOCATION ||
  process.env.VITE_GCP_LOCATION ||
  process.env.GOOGLE_CLOUD_LOCATION ||
  "us-central1";
const vertexModelId =
  process.env.VERTEX_MODEL_ID ||
  process.env.VITE_VERTEX_MODEL ||
  "gemini-live-2.5-flash-preview-native-audio-09-2025";
const vertexApiVersion =
  process.env.VERTEX_API_VERSION ||
  process.env.VITE_GEMINI_API_VERSION ||
  "v1";

console.log(`[token-server] Using service account key: ${keyFilePath}`);
console.log(
  `[token-server] Vertex config project=${vertexProjectId || "(missing)"} location=${vertexLocation} model=${vertexModelId} apiVersion=${vertexApiVersion}`,
);

const auth = new GoogleAuth({
  keyFile: keyFilePath,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const app = express();
app.use(cors({ origin: true }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Token endpoint — generates a short-lived access token (optional for debugging)
app.get("/api/token", async (_req, res) => {
  try {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();

    if (!tokenResponse.token) {
      throw new Error("Failed to generate access token");
    }

    // Access tokens typically expire in 3600 seconds (1 hour)
    res.json({
      accessToken: tokenResponse.token,
      expiresAt: Date.now() + 3500_000, // 3500s to refresh slightly before expiry
    });

    console.log(`[token-server] Token generated at ${new Date().toISOString()}`);
  } catch (err: any) {
    console.error("[token-server] Token generation failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

function loadSystemPrompt(): string | undefined {
  const promptPath = path.join(projectRoot, "prompt", "v1.0.txt");
  try {
    const text = fs.readFileSync(promptPath, "utf8");
    console.log(`[token-server] 📄 system prompt loaded (${text.length} chars)`);
    return text;
  } catch (err) {
    console.warn("[token-server] System prompt not found; proceeding without it", err);
    return undefined;
  }
}

function buildTools() {
  return [
    {
      functionDeclarations: [
        {
          name: "emit_canvas_patches",
          description: "Apply one or more canvas patches; never generate UI code.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              patches: {
                type: Type.ARRAY,
                items: { type: Type.OBJECT },
              },
            },
            required: ["patches"],
          },
        },
        {
          name: "request_snapshot_burst",
          description: "Ask client for low-FPS screen snapshots when you need visual confirmation.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              reason: { type: Type.STRING },
              duration_s: { type: Type.INTEGER },
              fps: { type: Type.NUMBER },
            },
            required: ["reason"],
          },
        },
      ],
    },
  ];
}

async function createVertexSession(callbacks: {
  onOpen?: () => void;
  onSetupComplete?: () => void;
  onAudio?: (base64Pcm: string, mimeType?: string) => void;
  onToolCall?: (functionCalls: FunctionCall[]) => void;
  onInterrupted?: () => void;
  onTranscript?: (source: "user" | "model", text: string) => void;
  onClose?: (reason?: string) => void;
  onError?: (message: string) => void;
}) {
  if (!vertexProjectId) {
    throw new Error("VERTEX_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) is required");
  }

  const genAI = new GoogleGenAI({
    vertexai: true,
    project: vertexProjectId,
    location: vertexLocation,
    apiVersion: vertexApiVersion,
    googleAuthOptions: {
      keyFile: keyFilePath,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    },
  });

  const systemInstruction = loadSystemPrompt();

  return await genAI.live.connect({
    model: vertexModelId,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
      },
      tools: buildTools() as any,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      ...(systemInstruction ? { systemInstruction } : {}),
    },
    callbacks: {
      onopen: () => callbacks.onOpen?.(),
      onmessage: (msg: LiveServerMessage) => {
        try {
          if (msg.setupComplete) {
            callbacks.onSetupComplete?.();
            return;
          }

          if (msg.toolCall) {
            const fcs = msg.toolCall.functionCalls ?? [];
            callbacks.onToolCall?.(fcs as FunctionCall[]);
            return;
          }

          if (msg.toolCallCancellation) {
            return;
          }

          if (msg.serverContent) {
            if ((msg.serverContent as any).interrupted) {
              callbacks.onInterrupted?.();
            }

            const inputTranscript = (msg.serverContent as any).inputTranscription;
            if (inputTranscript?.text) {
              callbacks.onTranscript?.("user", inputTranscript.text);
            }

            const outputTranscript = (msg.serverContent as any).outputTranscription;
            if (outputTranscript?.text) {
              callbacks.onTranscript?.("model", outputTranscript.text);
            }
          }

          const parts = (msg as any)?.serverContent?.modelTurn?.parts;
          if (Array.isArray(parts)) {
            for (const p of parts) {
              const inlineData = p?.inlineData;
              if (inlineData?.data && inlineData?.mimeType?.startsWith("audio/")) {
                callbacks.onAudio?.(inlineData.data, inlineData.mimeType);
              }
            }
          }
        } catch (err: any) {
          callbacks.onError?.(err?.message || "onmessage error");
        }
      },
      onerror: (err: any) => {
        callbacks.onError?.(err?.message || "live session error");
      },
      onclose: (evt: any) => {
        const reason = evt?.reason || "closed";
        const code = typeof evt?.code === "number" ? evt.code : undefined;
        const closeMsg = code ? `close code ${code}: ${reason}` : reason;
        callbacks.onClose?.(closeMsg);
      },
    },
  });
}

const server = app.listen(PORT, () => {
  console.log(`[token-server] Running on http://localhost:${PORT}`);
  console.log(`[token-server] Token endpoint: http://localhost:${PORT}/api/token`);
  console.log(`[token-server] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[token-server] Live proxy: ws://localhost:${PORT}${LIVE_WS_PATH}`);
});

const wss = new WebSocketServer({ server, path: LIVE_WS_PATH });

wss.on("connection", (socket) => {
  console.log("[token-server] 🔗 proxy websocket connected");
  let session: Awaited<ReturnType<typeof createVertexSession>> | null = null;
  let closed = false;

  const safeSend = (payload: unknown) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  const closeSession = async (reason?: string) => {
    if (closed) return;
    closed = true;
    try {
      await session?.close();
    } catch {
      /* ignore */
    }
    if (reason) safeSend({ type: "error", message: reason });
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1011, reason?.slice(0, 120) || "closed");
    }
  };

  createVertexSession({
    onOpen: () => {
      console.log("[token-server] 🔌 vertex session open");
    },
    onSetupComplete: () => {
      console.log("[token-server] ✅ setup complete");
      safeSend({ type: "setupComplete" });
    },
    onAudio: (base64Pcm, mimeType) => {
      safeSend({ type: "audio", data: base64Pcm, mimeType });
    },
    onToolCall: (functionCalls) => {
      const normalized = functionCalls.map((fc: FunctionCall) => {
        let args = fc.args as unknown;
        if (typeof args === "string") {
          try {
            args = JSON.parse(args);
          } catch {
            /* leave as string */
          }
        }
        return { ...fc, args };
      });

      console.log(
        `[token-server] 🔧 tool call: ${normalized
          .map((fc) => fc.name)
          .filter(Boolean)
          .join(", ")}`,
      );
      safeSend({ type: "toolCall", functionCalls: normalized });

      const responses = normalized
        .filter((fc: FunctionCall) => fc.id)
        .map((fc: FunctionCall) => ({
          id: fc.id!,
          name: fc.name!,
          response: { result: "ok" },
        }));

      if (responses.length > 0) {
        try {
          console.log(`[token-server] 📤 tool responses: ${responses.map((r) => r.name).join(", ")}`);
          session?.sendToolResponse({ functionResponses: responses });
        } catch (err: any) {
          safeSend({ type: "error", message: `toolResponse failed: ${String(err)}` });
        }
      }
    },
    onInterrupted: () => {
      console.log("[token-server] 🛑 interrupted");
      safeSend({ type: "interrupted" });
    },
    onTranscript: (source, text) => {
      console.log(`[token-server] ${source === "user" ? "🎤" : "🤖"} ${text}`);
      safeSend({ type: "transcript", source, text });
    },
    onError: (message) => {
      console.log(`[token-server] ❌ ${message}`);
      safeSend({ type: "error", message });
    },
    onClose: (reason) => {
      console.log(`[token-server] 🔒 session closed: ${reason || "session closed"}`);
      closeSession(reason || "session closed");
    },
  })
    .then((s) => {
      session = s;
    })
    .catch((err: any) => {
      safeSend({ type: "error", message: err?.message || "failed to start session" });
      closeSession(err?.message);
    });

  socket.on("message", (data) => {
    if (!session) return;
    let msg: any;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      safeSend({ type: "error", message: "invalid JSON from client" });
      return;
    }

    if (msg?.type === "audio" && msg.data) {
      session.sendRealtimeInput({
        audio: {
          data: msg.data,
          mimeType: msg.mimeType || "audio/pcm;rate=16000",
        },
      });
      return;
    }

    if (msg?.type === "image" && msg.data) {
      session.sendRealtimeInput({
        video: {
          data: msg.data,
          mimeType: msg.mimeType || "image/png",
        },
      });
      return;
    }

    if (msg?.type === "text" && typeof msg.text === "string") {
      session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: msg.text }] }],
        turnComplete: true,
      });
      return;
    }
  });

  socket.on("close", () => {
    console.log("[token-server] 🔌 proxy websocket closed");
    closeSession();
  });
});
