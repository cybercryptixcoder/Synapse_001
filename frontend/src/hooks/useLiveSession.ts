import { useRef, useState } from 'react';

export type SessionStatus = 'disconnected' | 'connecting' | 'connected';

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface UseLiveSessionOptions {
  onAudioChunk: (base64: string, mimeType: string) => void;
  onInterrupted: () => void;
  onToolCall: (call: ToolCall) => void;
}

/**
 * Manages the WebSocket connection to the backend proxy.
 * Routes incoming audio chunks, tool calls, and session signals.
 */
export function useLiveSession({ onAudioChunk, onInterrupted, onToolCall }: UseLiveSessionOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<SessionStatus>('disconnected');

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      setStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);

          switch (msg.type) {
            case 'ready':
              setStatus('connected');
              resolve();
              break;
            case 'audio':
              onAudioChunk(msg.data as string, msg.mimeType as string);
              break;
            case 'interrupted':
              onInterrupted();
              break;
            case 'tool_call':
              onToolCall({ name: msg.name as string, args: msg.args as Record<string, unknown> });
              break;
            case 'turn_complete':
              break;
          }
        } catch (err) {
          console.error('[session] Failed to parse message:', err);
        }
      };

      ws.onerror = (e) => {
        console.error('[session] WebSocket error:', e);
        setStatus('disconnected');
        reject(new Error('WebSocket error'));
      };

      ws.onclose = () => {
        setStatus('disconnected');
        wsRef.current = null;
      };
    });
  }

  function sendAudio(base64: string) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'audio', data: base64, mimeType: 'audio/pcm;rate=16000' })
      );
    }
  }

  /** Inject canvas state into the model's context. */
  function sendContext(text: string) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'context', text }));
    }
  }

  function disconnect() {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  }

  return { connect, disconnect, sendAudio, sendContext, status };
}
