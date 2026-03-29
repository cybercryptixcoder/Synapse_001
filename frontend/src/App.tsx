import { useCallback, useRef } from 'react';
import { CanvasProvider, useCanvas } from './canvas/CanvasProvider';
import { Canvas } from './canvas/Canvas';
import { useLiveSession, type ToolCall } from './hooks/useLiveSession';
import { useAudioIO } from './hooks/useAudioIO';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import type { CodeViewerData } from './widgets/CodeViewer';
import type { CallStackData } from './widgets/CallStack';
import './App.css';

export default function App() {
  return (
    <CanvasProvider>
      <AppInner />
    </CanvasProvider>
  );
}

function AppInner() {
  const { addWidget, removeWidget, updateWidget } = useCanvas();
  const { playChunk, flush } = useAudioPlayback();

  // Track the active call stack widget ID so push/pop/overflow can mutate it
  const callStackIdRef = useRef<string | null>(null);
  // Stable ref for the latest call stack data (avoids stale closure in callbacks)
  const callStackDataRef = useRef<CallStackData>({ frames: [], overflow: false });
  // Counter for unique frame IDs
  const frameCounterRef = useRef(0);

  const handleToolCall = useCallback(
    (call: ToolCall) => {
      switch (call.name) {

        // ── Code Viewer ──────────────────────────────────────────────
        case 'code_viewer_show': {
          const { language, code } = call.args as unknown as CodeViewerData;
          addWidget('code_viewer', { language, code }, 2, 2);
          break;
        }

        // ── Call Stack ───────────────────────────────────────────────
        case 'call_stack_show': {
          const initial: CallStackData = { frames: [], overflow: false };
          callStackDataRef.current = initial;
          const id = addWidget('call_stack', initial, 1, 2);
          callStackIdRef.current = id;
          break;
        }

        case 'call_stack_push': {
          if (!callStackIdRef.current) break;
          const { function_name, args: frameArgs } = call.args as {
            function_name: string;
            args: string;
          };
          const newFrame = {
            id: `frame_${frameCounterRef.current++}`,
            function_name,
            args: frameArgs,
          };
          const next: CallStackData = {
            frames: [...callStackDataRef.current.frames, newFrame],
            overflow: callStackDataRef.current.overflow,
          };
          callStackDataRef.current = next;
          updateWidget(callStackIdRef.current, next);
          break;
        }

        case 'call_stack_pop': {
          if (!callStackIdRef.current) break;
          const popped: CallStackData = {
            frames: callStackDataRef.current.frames.slice(0, -1),
            overflow: false,
          };
          callStackDataRef.current = popped;
          updateWidget(callStackIdRef.current, popped);
          break;
        }

        case 'call_stack_overflow': {
          if (!callStackIdRef.current) break;
          const overflowed: CallStackData = {
            frames: callStackDataRef.current.frames,
            overflow: true,
          };
          callStackDataRef.current = overflowed;
          updateWidget(callStackIdRef.current, overflowed);
          break;
        }

        case 'call_stack_remove': {
          if (!callStackIdRef.current) break;
          removeWidget(callStackIdRef.current);
          callStackIdRef.current = null;
          callStackDataRef.current = { frames: [], overflow: false };
          break;
        }
      }
    },
    [addWidget, removeWidget, updateWidget]
  );

  const { connect, disconnect, sendAudio, status } = useLiveSession({
    onAudioChunk: (base64) => playChunk(base64),
    onInterrupted: () => flush(),
    onToolCall: handleToolCall,
  });

  const { start: startMic, stop: stopMic, isRecording } = useAudioIO(
    useCallback((chunk: string) => sendAudio(chunk), [sendAudio])
  );

  async function handleStart() {
    try {
      await connect();
      await startMic();
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  }

  function handleStop() {
    stopMic();
    disconnect();
    flush();
    // Reset call stack state on session end
    callStackIdRef.current = null;
    callStackDataRef.current = { frames: [], overflow: false };
    frameCounterRef.current = 0;
  }

  const canStart = status === 'disconnected' && !isRecording;
  const canStop = isRecording || status === 'connected';

  return (
    <div className="app">
      <header className="app-header">
        <h1>Synapse</h1>
        <div className={`status-dot status-${status}`} title={status} />
      </header>

      <main className="app-main">
        <div className="controls-bar">
          <p className="status-label">{statusLabel(status, isRecording)}</p>
          <div className="controls">
            <button onClick={handleStart} disabled={!canStart} className="btn btn-start">
              Start
            </button>
            <button onClick={handleStop} disabled={!canStop} className="btn btn-stop">
              Stop
            </button>
          </div>
        </div>

        <Canvas />
      </main>
    </div>
  );
}

function statusLabel(status: string, isRecording: boolean): string {
  if (status === 'connecting') return 'Connecting…';
  if (status === 'connected' && isRecording) return 'Listening';
  if (status === 'connected') return 'Connected';
  return 'Disconnected';
}
