/**
 * Live connector using @google/genai (Developer API key, no Vertex project required).
 * Normalized to documented live.connect usage.
 */
import { GoogleGenAI } from "@google/genai";

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
};

// Developer API live model; supported on v1alpha
const MODEL = "gemini-2.0-flash-exp";

function buildTools() {
  return [
    {
      functionDeclarations: [
        {
          name: "emit_canvas_patches",
          description: "Apply one or more canvas patches; never generate UI code.",
          parameters: {
            type: "OBJECT",
            properties: {
              patches: { type: "ARRAY", items: { type: "OBJECT" } },
            },
            required: ["patches"],
          },
        },
        {
          name: "request_snapshot_burst",
          description: "Ask client for low-FPS screen snapshots when you need visual confirmation.",
          parameters: {
            type: "OBJECT",
            properties: {
              reason: { type: "STRING" },
              duration_s: { type: "INTEGER", default: 8 },
              fps: { type: "NUMBER", default: 1.0 },
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

function decodeToolCalls(msg: any): Array<{ name: string; args: unknown }> {
  const calls: Array<{ name: string; args: unknown }> = [];
  const modelTurn = msg?.serverContent?.modelTurn;
  const tc = modelTurn?.toolCalls ?? modelTurn?.toolCall ?? [];
  (Array.isArray(tc) ? tc : [tc]).forEach((call: any) => {
    if (!call) return;
    const name = call.name ?? call.functionCall?.name;
    const args = call.args ?? call.arguments ?? call.functionCall?.args;
    if (name) calls.push({ name, args });
  });
  (modelTurn?.parts ?? []).forEach((p: any) => {
    const fc = p?.functionCall;
    if (fc?.name) calls.push({ name: fc.name, args: fc.args });
  });
  return calls;
}

export async function createLiveSession(apiKey: string, callbacks: LiveCallbacks): Promise<LiveSession> {
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const genAI = new GoogleGenAI({ apiKey, apiVersion: "v1alpha" });
  if (!genAI.live || typeof genAI.live.connect !== "function") {
    throw new Error("Live API not available in @google/genai version");
  }

  const session = await genAI.live.connect({
    model: MODEL,
    config: {
      responseModalities: ["AUDIO"] as any,
      tools: buildTools() as any,
    },
    callbacks: {
      onopen: () => callbacks.onOpen?.(),
      onmessage: (msg: any) => {
        try {
          decodeAudioParts(msg).forEach((buf) => callbacks.onAudio(buf));
          decodeToolCalls(msg).forEach((c) => callbacks.onToolCall(c.name, c.args));
        } catch (e) {
          console.error("onmessage decode error", e);
        }
      },
      onerror: (err: any) => callbacks.onClose(err?.message ?? "live session error"),
      onclose: (evt: any) => callbacks.onClose(evt?.reason ?? "closed"),
    },
  });

  const sendAudio = (chunk: ArrayBuffer) => {
    try {
      let binary = '';
      const bytes = new Uint8Array(chunk);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);

      session.sendRealtimeInput({
        media: {
          mimeType: "audio/pcm;rate=16000",
          data: b64,
        }
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
