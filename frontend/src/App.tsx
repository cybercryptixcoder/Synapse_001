import { useCallback, useState } from 'react';
import { useLiveSession, type ToolCall } from './hooks/useLiveSession';
import { useAudioIO } from './hooks/useAudioIO';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import './App.css';

export default function App() {
  const { playChunk, flush } = useAudioPlayback();
  const [toolLog, setToolLog] = useState<ToolCall[]>([]);

  const handleToolCall = useCallback((call: ToolCall) => {
    console.log('[canvas] tool_call received:', call.name, call.args);
    setToolLog((prev) => [call, ...prev].slice(0, 10));
  }, []);

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
        <p className="status-label">{statusLabel(status, isRecording)}</p>

        <div className="controls">
          <button onClick={handleStart} disabled={!canStart} className="btn btn-start">
            Start
          </button>
          <button onClick={handleStop} disabled={!canStop} className="btn btn-stop">
            Stop
          </button>
        </div>

        {/* Tool call debug panel */}
        <div className="debug-panel">
          <p className="debug-title">Tool calls received</p>
          {toolLog.length === 0 ? (
            <p className="debug-empty">None yet — ask the agent to show you some code</p>
          ) : (
            <ul className="debug-list">
              {toolLog.map((call, i) => (
                <li key={i} className="debug-item">
                  <span className="debug-name">{call.name}</span>
                  <pre className="debug-args">{JSON.stringify(call.args, null, 2)}</pre>
                </li>
              ))}
            </ul>
          )}
        </div>
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
