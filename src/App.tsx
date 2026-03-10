import React, { useMemo, useState, useCallback } from "react";
import { CanvasProvider, useCanvas } from "./canvas/CanvasProvider";
import { CanvasView } from "./components/CanvasView";
import { FloatingInput } from "./components/FloatingInput";
import { DevTerminal, DevLog } from "./components/DevTerminal";
import { useWorkerRunner } from "./hooks/useWorkerRunner";
import { useLiveSession } from "./hooks/useLiveSession";
import { Patch } from "./canvas/types";
import { useAudioIO } from "./hooks/useAudioIO";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { useSnapshotBurst } from "./hooks/useSnapshotBurst";

const SessionShell: React.FC = () => {
  const { state, dispatchPatches } = useCanvas();
  const [status, setStatus] = useState<string>("connecting");
  const [serverError, setServerError] = useState<string | null>(null);
  const [logs, setLogs] = useState<DevLog[]>([]);

  const pushLog = useCallback(
    (level: DevLog["level"], message: string) => {
      setLogs((prev) => [...prev.slice(-499), { ts: Date.now(), level, message }]);
    },
    [],
  );

  const { runCode } = useWorkerRunner((result) => {
    const entries = [
      ...(result.stdout || []).map((text) => ({ kind: "stdout" as const, text })),
      ...(result.stderr || []).map((text) => ({ kind: "stderr" as const, text })),
    ];
    if (result.error) {
      entries.push({ kind: "stderr" as const, text: result.error });
    }
    const patches: Patch[] = [
      {
        op: "add",
        component: {
          kind: "outputTerminal",
          id: "output-terminal-1",
          entries,
        },
      },
    ];
    dispatchPatches(patches);
  });

  const envForceMock = import.meta.env.VITE_FORCE_MOCK === "true";
  const initialMode: "mock" | "live" = useMemo(() => {
    const hasKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY);
    if (envForceMock) return "mock";
    return hasKey ? "live" : "mock";
  }, [envForceMock]);

  const { startBurst } = useSnapshotBurst();
  const [modeOverride, setModeOverride] = useState<"mock" | "live" | null>(null);

  const chosenMode = modeOverride ?? initialMode;

  const [liveEnabled, setLiveEnabled] = useState<boolean>(chosenMode === "live");

  const { enqueue, clear } = useAudioPlayback(liveEnabled, setStatus);

  const { mode, status: liveStatus, sendAudio, sendText, sendImage, setMode, sessionReady, wsState, retry } = useLiveSession(
    chosenMode,
    {
      onPatches: (patches) => {
        pushLog("info", `patches received: ${patches.length}`);
        dispatchPatches(patches);
      },
      onStatus: (s) => {
        setStatus(s);
        pushLog("info", `status: ${s}`);
      },
      onSnapshotRequest: ({ reason, durationMs, fps }) => {
        startBurst({
          reason,
          durationMs,
          fps,
          onStatus: setStatus,
          onCapture: (blob) => {
            setStatus(`snapshot captured (${(blob.size / 1024).toFixed(1)} KB)`);
            pushLog("info", `snapshot captured ${blob.size} bytes`);
            // Send the snapshot to the model if live
            if (sendImage) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const dataUrl = reader.result as string;
                const b64 = dataUrl.split(",")[1];
                if (b64) sendImage(b64);
              };
              reader.readAsDataURL(blob);
            }
          },
        });
      },
      onAudioFromModel: (pcm) => enqueue(pcm),
      onInterrupted: () => clear(),
      onServerError: (msg) => {
        setServerError(msg);
        pushLog("error", msg);
      },
    },
  );

  // Mic capture -> sendAudio when live ready
  useAudioIO({
    enabled: liveEnabled && !!sendAudio && sessionReady,
    sendAudio,
    onStatus: setStatus,
  });

  // Sync liveEnabled with actual mode (e.g., fallback)
  React.useEffect(() => {
    setLiveEnabled(mode === "live");
  }, [mode]);

  // Log WS state transitions and ready state
  React.useEffect(() => {
    pushLog("info", `wsState: ${wsState}`);
  }, [wsState, pushLog]);
  React.useEffect(() => {
    pushLog("info", `sessionReady: ${sessionReady}`);
  }, [sessionReady, pushLog]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "canvasState.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleMode = useCallback(() => {
    const next = mode === "live" ? "mock" : "live";
    setModeOverride(next);
    setMode(next);
    setLiveEnabled(next === "live");
  }, [mode, setMode]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="badge">Synapse MVP</span>
          <span className="pill">Mode: {mode}</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="pill">Status: {status}</div>
          <div className="pill">WS: {wsState}</div>
          <div className="pill">Ready: {sessionReady ? "yes" : "no"}</div>
          <button
            onClick={toggleMode}
            style={{
              border: "1px solid #cbd5e1",
              background: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {mode === "live" ? "Switch to Mock" : "Switch to Live"}
          </button>
          {mode === "live" && (
            <button
              onClick={retry}
              style={{
                border: "1px solid #cbd5e1",
                background: "#fff",
                borderRadius: 8,
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          )}
          <button
            onClick={handleExport}
            style={{
              border: "1px solid #cbd5e1",
              background: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Export
          </button>
        </div>
      </header>
      <div style={{ padding: "8px 20px", color: "#475569", fontSize: 12 }}>
        <span className="pill">Live status: {status}</span>
        <span style={{ marginLeft: 8 }} className="pill">
          Mode override: {modeOverride ?? "auto"}
        </span>
        {serverError && (
          <span style={{ marginLeft: 8 }} className="pill pill-warn">
            Server error: {serverError}
          </span>
        )}
      </div>
      <CanvasView />
      <FloatingInput onSubmit={(val) => {
        // In live mode, send text to AI; always run code too
        if (sendText && sessionReady) sendText(val);
        runCode(val);
      }} />
      <DevTerminal logs={logs} onClear={() => setLogs([])} />
    </div>
  );
};

const App: React.FC = () => (
  <CanvasProvider>
    <SessionShell />
  </CanvasProvider>
);

export default App;
