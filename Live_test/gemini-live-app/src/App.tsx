import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { GeminiLiveClient } from './lib/gemini-client';
import { AudioStreamPlayer, encodeMonoAudioToBase64 } from './lib/audio-utils';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [logs, setLogs] = useState<{ sender: 'user' | 'model' | 'system', text: string }[]>([]);

  const geminiClientRef = useRef<GeminiLiveClient | null>(null);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (sender: 'user' | 'model' | 'system', text: string) => {
    setLogs(prev => [...prev, { sender, text }]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const cleanupAudio = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (microphoneRef.current) {
      microphoneRef.current.getTracks().forEach(track => track.stop());
      microphoneRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }
  };

  const startInteraction = async () => {
    if (!apiKey) {
      setStatus('error');
      setErrorMsg('Please enter a Gemini API Key');
      return;
    }

    try {
      setStatus('listening');
      addLog('system', 'Starting live voice session...');
      setErrorMsg('');

      audioPlayerRef.current = new AudioStreamPlayer();

      geminiClientRef.current = new GeminiLiveClient({
        apiKey,
        onAudioData: (base64Audio) => {
          if (audioPlayerRef.current) {
            audioPlayerRef.current.playPCM(base64Audio);
          }
        },
        onTextData: (text) => {
          addLog('model', text);
        },
        onInterrupted: () => {
          // Barge-in: instantly flush the speaker queue
          if (audioPlayerRef.current) {
            audioPlayerRef.current.clearQueue();
          }
          addLog('system', 'Interrupted — stopped playback.');
        },
        onStatusChange: (newStatus, err) => {
          setStatus(newStatus);
          if (err) setErrorMsg(err);
        }
      });

      await geminiClientRef.current.connect();

      // Setup microphone streaming
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000
        }
      });
      microphoneRef.current = stream;

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      const source = audioContextRef.current.createMediaStreamSource(stream);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const base64Pcm = encodeMonoAudioToBase64(inputData);

        if (geminiClientRef.current) {
          geminiClientRef.current.sendAudio(base64Pcm);
        }
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setErrorMsg(e.message || 'An error occurred accessing microphone or connecting.');
      cleanupAudio();
    }
  };

  const stopInteraction = () => {
    cleanupAudio();
    if (geminiClientRef.current) {
      geminiClientRef.current.disconnect();
      geminiClientRef.current = null;
    }
    setStatus('idle');
    addLog('system', 'Session disconnected.');
  };

  return (
    <div className="app-container">
      <div className="glass-panel">
        <div className="header">
          <h1>Gemini Live Voice Agent</h1>
          <p>Real-time bidirectional interactions using @google/genai</p>
        </div>

        {status === 'idle' && (
          <div className="input-group">
            <label>Gemini API Key</label>
            <input
              type="password"
              className="input-field"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        )}

        {status === 'error' && (
          <div style={{ color: '#fca5a5', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}

        <div className="orb-container">
          <div className={`orb ${status}`}></div>
        </div>

        <div className="status-text">
          {status === 'idle' && 'Ready to Connect'}
          {status === 'listening' && 'Listening...'}
          {status === 'speaking' && 'Speaking...'}
          {status === 'error' && 'Connection Error'}
        </div>

        <div className="controls">
          {status === 'idle' || status === 'error' ? (
            <button className="btn btn-primary" onClick={startInteraction}>
              <Mic size={20} />
              Connect & Talk
            </button>
          ) : (
            <button className="btn btn-danger" onClick={stopInteraction}>
              <MicOff size={20} />
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="log-panel">
        {logs.map((log, index) => (
          <div key={index} className={`log-entry ${log.sender}`}>
            <strong>{log.sender.toUpperCase()}:</strong> {log.text}
          </div>
        ))}
        {logs.length === 0 && <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.5 }}>No messages yet</div>}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

export default App;
