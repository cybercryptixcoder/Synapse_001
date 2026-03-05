import React, { useMemo, useState, useCallback } from "react";
import { CanvasProvider, useCanvas } from "./canvas/CanvasProvider";
import { CanvasView } from "./components/CanvasView";
import { FloatingInput } from "./components/FloatingInput";
import { useWorkerRunner } from "./hooks/useWorkerRunner";
import { useLiveSession } from "./hooks/useLiveSession";
import { Patch } from "./canvas/types";
import { useAudioIO } from "./hooks/useAudioIO";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { useSnapshotBurst } from "./hooks/useSnapshotBurst";

const SessionShell: React.FC = () => {
  const { state, dispatchPatches } = useCanvas();
  const [status, setStatus] = useState<string>("connecting");

  const { runCode } = useWorkerRunner((result) => {
    const patches: Patch[] = [
      {
        op: "add",
        component: {
          kind: "outputTerminal",
          id: "output-terminal-1",
          entries: [
            ...(result.stdout || []).map((text) => ({ kind: "stdout", text })),
            ...(result.stderr || []).map((text) => ({ kind: "stderr", text })),
          ],
        },
      },
    ];
    if (result.error) {
      patches[0].component.entries.push({ kind: "stderr", text: result.error });
    }
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

  const { enqueue } = useAudioPlayback(liveEnabled, setStatus);

  const { mode, status: liveStatus, sendAudio, setMode } = useLiveSession(chosenMode, {
    onPatches: dispatchPatches,
    onStatus: setStatus,
    onSnapshotRequest: ({ reason, durationMs, fps }) => {
      startBurst({
        reason,
        durationMs,
        fps,
        onStatus: setStatus,
        onCapture: (blob) => {
          // TODO: send snapshot to model when SDK supports it; for now log size.
          setStatus(`snapshot captured (${(blob.size / 1024).toFixed(1)} KB)`);
        },
      });
    },
    onAudioFromModel: (pcm) => enqueue(pcm),
  });

  // Mic capture -> sendAudio when live ready
  useAudioIO({
    enabled: liveEnabled && !!sendAudio,
    sendAudio,
    onStatus: setStatus,
  });

  // Sync liveEnabled with actual mode (e.g., fallback)
  React.useEffect(() => {
    setLiveEnabled(mode === "live");
  }, [mode]);

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
      </div>
      <CanvasView />
      <FloatingInput onSubmit={(val) => runCode(val)} />
    </div>
  );
};

const App: React.FC = () => (
  <CanvasProvider>
    <SessionShell />
  </CanvasProvider>
);

export default App;
