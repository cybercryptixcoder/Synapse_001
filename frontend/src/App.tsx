import { useCallback } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import { useAudioIO } from './hooks/useAudioIO';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import './App.css';

export default function App() {
  const { playChunk, flush } = useAudioPlayback();

  const { connect, disconnect, sendAudio, status } = useLiveSession({
    onAudioChunk: (base64) => playChunk(base64),
    onInterrupted: () => flush(),
  });

  const { start: startMic, stop: stopMic, isRecording } = useAudioIO(
    useCallback((chunk: string) => sendAudio(chunk), [sendAudio])
  );

  async function handleStart() {
    try {
      await connect();   // wait for 'ready' from proxy
      await startMic();  // then open microphone
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
        <h1>BareMinimum</h1>
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

        {/* Canvas area — will be populated in Step 3 */}
        <div className="canvas-placeholder">
          <p>Canvas will appear here</p>
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
