/**
 * Live connector using @google/genai (Developer API key, no Vertex project required).
 * Aligned to documented SDK types: LiveServerMessage, LiveSendRealtimeInputParameters, etc.
 *
 * Reference: https://ai.google.dev/gemini-api/docs/live-tools
 */
import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { LiveServerMessage, FunctionCall } from "@google/genai";

type Patch = Record<string, unknown>;

export type LiveSession = {
  sendAudio: (chunk: ArrayBuffer) => void;
  sendText: (text: string) => void;
  sendImage: (base64Png: string) => void;
  close: () => Promise<void>;
};

export type LiveCallbacks = {
  onAudio: (pcm16: ArrayBuffer) => void;
  onToolCall: (toolName: string, args: unknown) => void;
  onClose: (reason?: string) => void;
  onOpen?: () => void;
  onSetupComplete?: () => void;
  onInterrupted?: () => void;
  onServerError?: (message: string) => void;
  onTranscript?: (source: "user" | "model", text: string) => void;
};

// The native-audio model supports audio I/O + function calling.
// gemini-live-2.5-flash-preview is text-only/audio output — NOT suitable for voice + tools.
const DEFAULT_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

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

export async function createLiveSession(apiKey: string, callbacks: LiveCallbacks): Promise<LiveSession> {
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const model = (import.meta.env.VITE_GEMINI_LIVE_MODEL as string | undefined) || DEFAULT_MODEL;
  const apiVersion = (import.meta.env.VITE_GEMINI_API_VERSION as string | undefined) || "v1alpha";

  console.log(`[connector] connecting to model=${model} apiVersion=${apiVersion}`);

  const genAI = new GoogleGenAI({ apiKey, apiVersion });
  if (!genAI.live || typeof genAI.live.connect !== "function") {
    throw new Error("Live API not available in @google/genai version");
  }

  // Load the frozen system prompt from prompt/v1.1.txt at build time.
  let systemInstruction: string | undefined;
  try {
    systemInstruction = (await import("../prompt/v1.1.txt?raw")).default as string;
  } catch (e) {
    console.warn("[connector] System prompt not found; proceeding without it", e);
  }

  let isOpen = false;

  const session = await genAI.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
      },
      tools: buildTools() as any,
      // Enable real-time transcription of both user input and model output
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      ...(systemInstruction ? { systemInstruction } : {}),
    },
    callbacks: {
      onopen: () => {
        isOpen = true;
        console.log("[connector] WebSocket opened");
        callbacks.onOpen?.();
      },
      onmessage: (msg: LiveServerMessage) => {
        try {
          // ── 1. setupComplete ──
          if (msg.setupComplete) {
            console.log("[connector] ✓ setupComplete", msg.setupComplete);
            callbacks.onSetupComplete?.();
            return; // setupComplete is the only thing in this message
          }

          // ── 2. Tool call (check FIRST — a message has toolCall OR serverContent, never both) ──
          if (msg.toolCall) {
            const fcs = msg.toolCall.functionCalls ?? [];
            console.log(`[connector] 🔧 tool call: ${fcs.map((fc: FunctionCall) => fc.name).join(", ")}`);

            // Dispatch each tool call to the app
            for (const fc of fcs) {
              console.log(`[connector]   → ${fc.name}(${JSON.stringify(fc.args)}) id=${fc.id}`);
              callbacks.onToolCall(fc.name!, fc.args);
            }

            // Send tool responses back immediately
            const responses = fcs
              .filter((fc: FunctionCall) => fc.id)
              .map((fc: FunctionCall) => ({
                id: fc.id!,
                name: fc.name!,
                response: { result: "ok" },
              }));

            if (responses.length > 0) {
              try {
                console.log("[connector] 📤 sending tool responses:", responses.map(r => r.name));
                session.sendToolResponse({ functionResponses: responses });
              } catch (err) {
                console.error("[connector] sendToolResponse failed:", err);
                callbacks.onServerError?.(`toolResponse failed: ${String(err)}`);
              }
            }
            return; // tool call message handled
          }

          // ── 3. Tool call cancellation ──
          if (msg.toolCallCancellation) {
            console.log("[connector] ⚠️ tool call cancelled:", msg.toolCallCancellation.ids);
            return;
          }

          // ── 4. Server content (audio, text, transcriptions) ──
          if (msg.serverContent) {
            // Interruption
            if ((msg.serverContent as any).interrupted) {
              console.log("[connector] 🛑 interrupted");
              callbacks.onInterrupted?.();
            }

            // Input transcription (what the user said)
            const inputTranscript = (msg.serverContent as any).inputTranscription;
            if (inputTranscript?.text) {
              console.log(`[connector] 🎤 user: "${inputTranscript.text}"`);
              callbacks.onTranscript?.("user", inputTranscript.text);
            }

            // Output transcription (what the model said)
            const outputTranscript = (msg.serverContent as any).outputTranscription;
            if (outputTranscript?.text) {
              console.log(`[connector] 🤖 model: "${outputTranscript.text}"`);
              callbacks.onTranscript?.("model", outputTranscript.text);
            }

            // Turn complete
            if (msg.serverContent.turnComplete) {
              console.log("[connector] ✅ turn complete");
            }
          }

          // ── 5. Audio data — extract directly from parts, NOT msg.data getter ──
          // The msg.data getter triggers SDK warnings when response has
          // text/thought parts alongside audio, which may contribute to instability.
          const parts = (msg as any)?.serverContent?.modelTurn?.parts;
          if (Array.isArray(parts)) {
            for (const p of parts) {
              const inlineData = p?.inlineData;
              if (inlineData?.data && inlineData?.mimeType?.startsWith("audio/")) {
                callbacks.onAudio(base64ToArrayBuffer(inlineData.data));
              }
            }
          }

        } catch (e) {
          console.error("[connector] onmessage decode error:", e);
        }
      },
      onerror: (err: any) => {
        isOpen = false;
        const errMsg = err?.message ?? "live session error";
        console.error("[connector] onerror:", errMsg);
        callbacks.onServerError?.(errMsg);
        callbacks.onClose(errMsg);
      },
      onclose: (evt: any) => {
        isOpen = false;
        const reason = evt?.reason || "closed";
        const code = typeof evt?.code === "number" ? evt.code : undefined;
        const closeMsg = code ? `close code ${code}: ${reason}` : reason;
        console.log("[connector] onclose:", closeMsg);
        callbacks.onClose(closeMsg);
      },
    },
  });

  const sendAudio = (chunk: ArrayBuffer) => {
    try {
      if (!session || !isOpen) return;
      const b64 = arrayBufferToBase64(chunk);
      session.sendRealtimeInput({
        audio: {
          data: b64,
          mimeType: "audio/pcm;rate=16000",
        },
      });
    } catch (e) {
      console.error("[connector] sendRealtimeInput error:", e);
    }
  };

  const sendText = (text: string) => {
    try {
      if (!session || !isOpen) return;
      console.log(`[connector] 📝 sending text: "${text}"`);
      session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      });
    } catch (e) {
      console.error("[connector] sendClientContent error:", e);
    }
  };

  const sendImage = (base64Png: string) => {
    try {
      if (!session || !isOpen) return;
      console.log("[connector] 📷 sending image");
      session.sendRealtimeInput({
        video: {
          data: base64Png,
          mimeType: "image/png",
        },
      });
    } catch (e) {
      console.error("[connector] sendImage error:", e);
    }
  };

  return {
    sendAudio,
    sendText,
    sendImage,
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
