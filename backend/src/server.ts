import 'dotenv/config';
import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality, FunctionResponseScheduling } from '@google/genai';
import { TOOL_DECLARATIONS } from './tools.js';
import { validate, isError } from './validator.js';

// gemini-2.5-flash-native-audio-preview-12-2025 supports NON_BLOCKING tool calls
const MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const PORT = Number(process.env.PORT) || 3001;

// ---------------------------------------------------------------------------
// Gemini client — standard Gemini API (supports NON_BLOCKING tool calls)
// ---------------------------------------------------------------------------
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const SYSTEM_PROMPT = `You are a helpful, knowledgeable voice assistant with access to a live visual canvas.

═══ AUTONOMY ═══
Never ask for permission to continue. Never pause mid-explanation to check in. Do not say things like "would you like me to continue?", "shall I show the next step?", "should I go on?", or any similar phrase. Deliver your full explanation from start to finish without stopping for approval. If your explanation has multiple parts, go through all of them without waiting.

If you receive unclear audio or don't catch what was said, briefly ask the user to repeat rather than going silent.

After each of your responses you will receive a [canvas: ...] status line. This is silent system metadata — never read it aloud, never acknowledge it, never respond to it. Use it only to check whether your tool calls landed correctly. If it says [canvas: empty] after you showed code, call code_viewer_show again immediately.

═══ CANVAS TOOL RULES ═══
Tool calls are completely invisible to the user. Never announce one before it fires. Never acknowledge one after it fires. Never say "let me show you", "here is the code", "as you can see on screen", "I've added that", or anything similar. Your speech flows as if the canvas does not exist — you speak, the canvas updates silently on its own.

═══ CODE VIEWER ═══
You MUST call code_viewer_show every single time you reference or describe specific code. No exceptions. This applies even after an interruption.

When you plan to walk through code section by section, call code_viewer_next_highlight(start_line, end_line) once for each section, in the order you will explain them. Use 1-indexed line numbers. Call all of them — the canvas handles the visual timing automatically and will reveal each highlight in sequence as you speak.

Keep spoken responses conversational and natural for audio delivery.`;

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/live' });

app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// One Gemini session per browser WebSocket connection
// ---------------------------------------------------------------------------
wss.on('connection', async (browserWs) => {
  console.log('[proxy] Browser connected');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let geminiSession: any = null;

  const safeSend = (payload: object) => {
    if (browserWs.readyState === WebSocket.OPEN) {
      try {
        browserWs.send(JSON.stringify(payload));
      } catch (e) {
        console.error('[proxy] safeSend failed:', e);
      }
    }
  };

  try {
    geminiSession = await ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Aoede' },
          },
        },
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      },
      callbacks: {
        onopen: () => {
          console.log('[proxy] Gemini session open');
          safeSend({ type: 'ready' });
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onmessage: (message: any) => {
          // --- Audio output ---
          const parts = message.serverContent?.modelTurn?.parts ?? [];
          for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith('audio/')) {
              safeSend({
                type: 'audio',
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType,
              });
            }
          }

          // --- Turn signals ---
          if (message.serverContent?.turnComplete) {
            safeSend({ type: 'turn_complete' });
          }
          if (message.serverContent?.interrupted) {
            safeSend({ type: 'interrupted' });
          }

          // --- Tool calls ---
          const functionCalls = message.toolCall?.functionCalls ?? [];
          for (const fc of functionCalls) {
            try {
              const args = (fc.args ?? {}) as Record<string, unknown>;
              const result = validate(fc.name as string, args);

              if (isError(result)) {
                console.warn(`[validator] Rejected call to "${fc.name}": ${result.reason}`);
                Promise.resolve(
                  geminiSession.sendToolResponse({
                    functionResponses: [
                      {
                        id: fc.id,
                        name: fc.name,
                        response: { error: result.reason },
                        scheduling: FunctionResponseScheduling.SILENT,
                      },
                    ],
                  })
                ).catch((e: unknown) => console.error(`[proxy] sendToolResponse (rejected) error:`, e));
                continue;
              }

              console.log(`[validator] Accepted: ${result.name}`, result.args);

              safeSend({
                type: 'tool_call',
                name: result.name,
                args: result.args,
              });

              // NON_BLOCKING + SILENT — model keeps talking uninterrupted
              Promise.resolve(
                geminiSession.sendToolResponse({
                  functionResponses: [
                    {
                      id: fc.id,
                      name: fc.name,
                      response: { result: 'ok' },
                      scheduling: FunctionResponseScheduling.SILENT,
                    },
                  ],
                })
              ).catch((e: unknown) => console.error(`[proxy] sendToolResponse error for "${fc.name}":`, e));
            } catch (e) {
              console.error(`[proxy] Unexpected error handling tool call "${fc.name}":`, e);
            }
          }
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onerror: (e: any) => {
          console.error('[proxy] Gemini error:', e);
        },

        onclose: () => {
          console.log('[proxy] Gemini session closed');
          if (browserWs.readyState === WebSocket.OPEN) browserWs.close();
        },
      },
    });
  } catch (err) {
    console.error('[proxy] Failed to connect to Gemini:', err);
    browserWs.close();
    return;
  }

  // --- Browser → Gemini ---
  browserWs.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'audio' && geminiSession) {
        geminiSession.sendRealtimeInput({
          audio: {
            data: msg.data,
            mimeType: msg.mimeType ?? 'audio/pcm;rate=16000',
          },
        });
      }

      if (msg.type === 'context' && geminiSession) {
        geminiSession.sendRealtimeInput({ text: msg.text as string });
      }
    } catch (err) {
      console.error('[proxy] Bad message from browser:', err);
    }
  });

  browserWs.on('close', () => {
    console.log('[proxy] Browser disconnected');
    try { geminiSession?.close?.(); } catch (_) { /* ignore */ }
  });
});

server.listen(PORT, () => {
  console.log(`[proxy] Listening on http://localhost:${PORT}`);
});
