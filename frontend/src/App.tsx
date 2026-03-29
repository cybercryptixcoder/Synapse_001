import { useCallback, useEffect, useRef } from 'react';
import { CanvasProvider, useCanvas } from './canvas/CanvasProvider';
import { Canvas } from './canvas/Canvas';
import { useLiveSession, type ToolCall } from './hooks/useLiveSession';
import { useAudioIO } from './hooks/useAudioIO';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import type { CodeViewerData } from './widgets/CodeViewer';
import type { CallStackData } from './widgets/CallStack';
import './App.css';

// Staggered highlight timing: first fires after a short pause,
// subsequent ones at fixed intervals. This makes batched tool calls
// cascade visually across the code while the agent speaks.
const HIGHLIGHT_INITIAL_DELAY = 500;   // ms before first highlight
const HIGHLIGHT_INTERVAL      = 3500;  // ms between subsequent highlights

export default function App() {
  return (
    <CanvasProvider>
      <AppInner />
    </CanvasProvider>
  );
}

function AppInner() {
  const { addWidget, removeWidget, updateWidget, clearWidgets, getInventoryString } = useCanvas();
  const { playChunk, flush, stop } = useAudioPlayback();

  // Track the active code viewer widget so highlight can update it
  const codeViewerIdRef   = useRef<string | null>(null);
  const codeViewerDataRef = useRef<CodeViewerData>({ language: '', code: '' });

  // Staggered highlight state
  const pendingTimersRef        = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pendingHighlightCountRef = useRef(0);

  // Always-current canvas inventory for turn_complete injection
  const inventoryRef = useRef(getInventoryString);
  useEffect(() => { inventoryRef.current = getInventoryString; }, [getInventoryString]);

  // Track the active call stack widget ID so push/pop/overflow can mutate it
  const callStackIdRef   = useRef<string | null>(null);
  const callStackDataRef = useRef<CallStackData>({ frames: [], overflow: false });
  const frameCounterRef  = useRef(0);

  // Cancel all pending highlight timers and reset the counter.
  // Called on new code_viewer_show, interrupt, and stop.
  function clearPendingHighlights() {
    for (const t of pendingTimersRef.current) clearTimeout(t);
    pendingTimersRef.current = [];
    pendingHighlightCountRef.current = 0;
  }

  const handleToolCall = useCallback(
    (call: ToolCall) => {
      switch (call.name) {

        // ── Code Viewer ──────────────────────────────────────────────
        case 'code_viewer_show': {
          const { language, code } = call.args as { language: string; code: string };
          clearPendingHighlights();
          const data: CodeViewerData = { language, code };
          codeViewerDataRef.current = data;
          const id = addWidget('code_viewer', data, 2, 2);
          codeViewerIdRef.current = id;
          break;
        }

        case 'code_viewer_next_highlight': {
          if (!codeViewerIdRef.current) break;
          const { start_line, end_line } = call.args as { start_line: number; end_line: number };
          if (!start_line || !end_line || start_line <= 0 || end_line <= 0) break;

          // Schedule this highlight with increasing delay so batched calls
          // cascade one-at-a-time while the agent speaks.
          const delay = HIGHLIGHT_INITIAL_DELAY + pendingHighlightCountRef.current * HIGHLIGHT_INTERVAL;
          pendingHighlightCountRef.current += 1;

          const timerId = setTimeout(() => {
            // Remove this timer from the list
            pendingTimersRef.current = pendingTimersRef.current.filter((t) => t !== timerId);
            if (!codeViewerIdRef.current) return; // widget was cleared (e.g. interrupt)
            const updated: CodeViewerData = {
              ...codeViewerDataRef.current,
              highlight: { start: start_line, end: end_line },
            };
            codeViewerDataRef.current = updated;
            updateWidget(codeViewerIdRef.current, updated);
          }, delay);

          pendingTimersRef.current.push(timerId);
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

  const { connect, disconnect, sendAudio, sendContext, status } = useLiveSession({
    onAudioChunk: (base64) => playChunk(base64),
    onInterrupted: () => {
      flush();
      clearWidgets();
      clearPendingHighlights();
      codeViewerIdRef.current = null;
      codeViewerDataRef.current = { language: '', code: '' };
    },
    onToolCall: handleToolCall,
    onTurnComplete: () => {
      sendContext(`[canvas: ${inventoryRef.current()}]`);
    },
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
    stop();
    clearPendingHighlights();
    codeViewerIdRef.current = null;
    codeViewerDataRef.current = { language: '', code: '' };
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
