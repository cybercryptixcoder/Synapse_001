/**
 * Live connector using @google/genai (Developer API key, no Vertex project required).
 * Normalized to documented live.connect usage.
 */
import { GoogleGenAI, Modality } from "@google/genai";

type Patch = Record<string, unknown>;

export type LiveSession = {
  sendAudio: (chunk: ArrayBuffer) => void;
  close: () => Promise<void>;
};

export type LiveCallbacks = {
  onAudio: (pcm16: ArrayBuffer) => void;
  onToolCall: (toolName: string, args: unknown) => void;
  onClose: (reason?: string) => void;
  onOpen?: () => void;
  onInterrupted?: () => void;
  onServerError?: (message: string) => void;
};

// Defaults align with the working standalone agent (the standalone demo that works)
const DEFAULT_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

function buildTools() {
  return [
    {
      functionDeclarations: [
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
      ],
    },
  ];
}

function decodeAudioParts(msg: any): ArrayBuffer[] {
  const buffers: ArrayBuffer[] = [];
  const modelTurn = msg?.serverContent?.modelTurn;
  const pushData = (data: any) => {
    if (!data) return;
    if (data instanceof Uint8Array) {
      buffers.push(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    } else if (typeof data === "string") {
      buffers.push(base64ToArrayBuffer(data));
    }
  };
  // outputAudio array
  (modelTurn?.outputAudio ?? []).forEach((a: any) => pushData(a?.data ?? a?.inlineData?.data));
  // parts inline data
  (modelTurn?.parts ?? []).forEach((p: any) => pushData(p?.inlineData?.data ?? p?.audio?.data));
  return buffers;
}

function decodeToolCalls(msg: any): Array<{ id?: string; name: string; args: unknown }> {
  const calls: Array<{ id?: string; name: string; args: unknown }> = [];
  const modelTurn = msg?.serverContent?.modelTurn;
  const tc = modelTurn?.toolCalls ?? modelTurn?.toolCall ?? [];
  (Array.isArray(tc) ? tc : [tc]).forEach((call: any) => {
    if (!call) return;
    const name = call.name ?? call.functionCall?.name;
    const args = call.args ?? call.arguments ?? call.functionCall?.args;
    const id = call.id ?? call.functionCall?.id;
    if (name) calls.push({ id, name, args });
  });
  (modelTurn?.parts ?? []).forEach((p: any) => {
    const fc = p?.functionCall;
    if (fc?.name) calls.push({ id: fc.id, name: fc.name, args: fc.args });
  });
  return calls;
}

function decodeServerError(msg: any): string | undefined {
  return msg?.serverContent?.error?.message || msg?.error?.message || msg?.error;
}

export async function createLiveSession(apiKey: string, callbacks: LiveCallbacks): Promise<LiveSession> {
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const model = (import.meta.env.VITE_GEMINI_LIVE_MODEL as string | undefined) || DEFAULT_MODEL;
  // Live WebSocket currently served on v1alpha; allow override
  const apiVersion = (import.meta.env.VITE_GEMINI_API_VERSION as string | undefined) || "v1alpha";

  const genAI = new GoogleGenAI({ apiKey, apiVersion });
  if (!genAI.live || typeof genAI.live.connect !== "function") {
    throw new Error("Live API not available in @google/genai version");
  }

  // Load the frozen system prompt from prompt/v1.0.txt at build time.
  // Vite import.meta.glob can’t be used here, so we embed via dynamic import of raw text.
  let systemInstruction: string | undefined;
  try {
    systemInstruction = (await import("../prompt/v1.0.txt?raw")).default as string;
  } catch (e) {
    console.warn("System prompt not found; proceeding without it", e);
  }

  let isOpen = false;

  const session = await genAI.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      tools: buildTools() as any,
      functionCallingConfig: "AUTO",
      ...(systemInstruction ? { systemInstruction } : {}),
    },
    callbacks: {
      onopen: () => {
        isOpen = true;
        callbacks.onOpen?.();
      },
      onmessage: (msg: any) => {
        try {
          if (msg?.serverContent?.interrupted) {
            callbacks.onInterrupted?.();
          }
          const serverErr = decodeServerError(msg);
          if (serverErr) {
            console.error("Live server error:", serverErr);
            callbacks.onServerError?.(serverErr);
          }
          decodeAudioParts(msg).forEach((buf) => callbacks.onAudio(buf));
          const toolCalls = decodeToolCalls(msg);
          toolCalls.forEach((c) => callbacks.onToolCall(c.name, c.args));
          // Send tool responses in the documented shape (result payload).
          if (toolCalls.length > 0) {
            const responses = toolCalls
              .filter((c) => c.id)
              .map((c) => ({
                id: c.id,
                name: c.name,
                response: { result: {} },
              }));
            if (responses.length > 0) {
              try {
                session.sendToolResponse({ toolResponse: { functionResponses: responses } });
              } catch (err) {
                console.warn("sendToolResponse failed", err);
                callbacks.onServerError?.(`toolResponse failed: ${String(err)}`);
              }
            }
          }
        } catch (e) {
          console.error("onmessage decode error", e);
        }
      },
      onerror: (err: any) => {
        isOpen = false;
        const msg = err?.message ?? "live session error";
        callbacks.onServerError?.(msg);
        callbacks.onClose(msg);
      },
      onclose: (evt: any) => {
        isOpen = false;
        const reason = evt?.reason || "closed";
        const code = typeof evt?.code === "number" ? evt.code : undefined;
        const msg = code ? `close code ${code}: ${reason}` : reason;
        callbacks.onServerError?.(msg);
        callbacks.onClose(msg);
      },
    },
  });

  const sendAudio = (chunk: ArrayBuffer) => {
    try {
      if (!session || !isOpen) return;
      const b64 = arrayBufferToBase64(chunk);
      session.sendRealtimeInput({
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "audio/pcm;rate=16000",
              data: b64,
            },
          ],
        },
      });
    } catch (e) {
      console.error("sendRealtimeInput error", e);
    }
  };

  return {
    sendAudio,
    close: async () => {
      try {
        await session.close();
      } catch {
        // ignore
      }
    },
  };
}

export function formatPatches(patches: Patch[]) {
  return { name: "emit_canvas_patches", output: { patches } };
}

function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
