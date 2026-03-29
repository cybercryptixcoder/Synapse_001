import 'dotenv/config';
import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import { TOOL_DECLARATIONS } from './tools.js';
import { validate, isError } from './validator.js';

const MODEL = 'gemini-live-2.5-flash-native-audio';
const PORT = Number(process.env.PORT) || 3001;

// ---------------------------------------------------------------------------
// Gemini client — Vertex AI, picks up GOOGLE_APPLICATION_CREDENTIALS via ADC
// ---------------------------------------------------------------------------
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
});

const SYSTEM_PROMPT = `You are a helpful, knowledgeable voice assistant with access to a live visual canvas that appears alongside this conversation.

You have canvas tools available to you. Use them freely and naturally — call them mid-sentence as soon as the relevant moment arrives in your explanation. The canvas updates silently while you speak.

When you explain code or want to illustrate something with code, call code_viewer_show immediately. Do not wait until the end of your turn.

IMPORTANT — canvas tool call rules:
- Never announce that you are about to call a tool. Do not say things like "let me show you", "here is the code", "I'll put that on screen", or "I'm displaying this now".
- Never acknowledge a tool call after it fires. Do not say things like "as you can see on the canvas", "I've added that to the screen", "the code is now displayed", or any similar confirmation.
- Tool calls are invisible to the user. You call them silently. Your speech should flow as if the canvas does not exist — you explain with your voice, the canvas updates on its own.

Keep your spoken responses conversational and natural for audio delivery.`;

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
      browserWs.send(JSON.stringify(payload));
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
            const args = (fc.args ?? {}) as Record<string, unknown>;
            const result = validate(fc.name as string, args);

            if (isError(result)) {
              console.warn(`[validator] Rejected call to "${fc.name}": ${result.reason}`);
              // Send an error response back so the model isn't left hanging
              geminiSession.sendToolResponse({
                functionResponses: [
                  {
                    id: fc.id,
                    name: fc.name,
                    response: { error: result.reason, scheduling: 'SILENT' },
                  },
                ],
              });
              continue;
            }

            console.log(`[validator] Accepted: ${result.name}`, result.args);

            // Forward validated call to browser for logging (no canvas yet)
            safeSend({
              type: 'tool_call',
              name: result.name,
              args: result.args,
            });

            // Acknowledge silently — model keeps talking uninterrupted
            geminiSession.sendToolResponse({
              functionResponses: [
                {
                  id: fc.id,
                  name: fc.name,
                  response: { result: 'ok', scheduling: 'SILENT' },
                },
              ],
            });
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
