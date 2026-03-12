import type { LiveCallbacks, LiveSession } from "../../live_connector/connector";

const DEFAULT_MIME_AUDIO = "audio/pcm;rate=16000";
const DEFAULT_MIME_IMAGE = "image/png";

type ServerMessage =
  | { type: "setupComplete" }
  | { type: "toolCall"; functionCalls: Array<{ id?: string; name?: string; args?: unknown }> }
  | { type: "audio"; data: string; mimeType?: string }
  | { type: "transcript"; source: "user" | "model"; text: string }
  | { type: "interrupted" }
  | { type: "error"; message: string }
  | { type: "status"; message: string };

type ClientMessage =
  | { type: "audio"; data: string; mimeType: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "text"; text: string };

function toWsUrl(url: string) {
  if (url.startsWith("ws://") || url.startsWith("wss://")) return url;
  if (url.startsWith("https://")) return url.replace("https://", "wss://");
  if (url.startsWith("http://")) return url.replace("http://", "ws://");
  return url; // assume ws
}

export async function createLiveSession(proxyUrl: string, callbacks: LiveCallbacks): Promise<LiveSession> {
  const wsUrl = toWsUrl(proxyUrl);
  const socket = new WebSocket(wsUrl);
  let isOpen = false;
  let closedByClient = false;

  const send = (payload: ClientMessage) => {
    if (!isOpen || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  };

  socket.onopen = () => {
    isOpen = true;
    console.log("[proxy] 🔌 ws open");
    callbacks.onOpen?.();
  };

  socket.onmessage = (evt) => {
    try {
      const msg = JSON.parse(String(evt.data)) as ServerMessage;
      switch (msg.type) {
        case "setupComplete":
          console.log("[proxy] ✅ setup complete");
          callbacks.onSetupComplete?.();
          break;
        case "toolCall":
          console.log(
            `[proxy] 🔧 tool call: ${(msg.functionCalls || [])
              .map((fc) => fc.name)
              .filter(Boolean)
              .join(", ")}`,
          );
          for (const fc of msg.functionCalls ?? []) {
            if (fc?.name) callbacks.onToolCall(fc.name, fc.args);
          }
          break;
        case "audio":
          callbacks.onAudio(base64ToArrayBuffer(msg.data));
          break;
        case "transcript":
          console.log(`[proxy] ${msg.source === "user" ? "🎤" : "🤖"} ${msg.text}`);
          callbacks.onTranscript?.(msg.source, msg.text);
          break;
        case "interrupted":
          console.log("[proxy] 🛑 interrupted");
          callbacks.onInterrupted?.();
          break;
        case "error":
          console.log(`[proxy] ❌ ${msg.message}`);
          callbacks.onServerError?.(msg.message);
          break;
        case "status":
          console.log(`[proxy] ℹ️ ${msg.message}`);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("[vertexProxyConnector] invalid message", err);
    }
  };

  socket.onerror = () => {
    if (closedByClient) return;
    if (socket.readyState === WebSocket.CLOSED) return;
    console.log("[proxy] ❌ ws error");
    callbacks.onServerError?.("proxy websocket error");
  };

  socket.onclose = (evt) => {
    isOpen = false;
    console.log(`[proxy] 🔒 ws closed: ${evt.reason || "closed"}`);
    callbacks.onClose(evt.reason || "closed");
  };

  const sendAudio = (chunk: ArrayBuffer) => {
    send({
      type: "audio",
      data: arrayBufferToBase64(chunk),
      mimeType: DEFAULT_MIME_AUDIO,
    });
  };

  const sendText = (text: string) => {
    send({ type: "text", text });
  };

  const sendImage = (base64Png: string) => {
    send({
      type: "image",
      data: base64Png,
      mimeType: DEFAULT_MIME_IMAGE,
    });
  };

  const close = async () => {
    try {
      closedByClient = true;
      socket.close();
    } catch {
      /* ignore */
    }
  };

  return { sendAudio, sendText, sendImage, close };
}

function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
