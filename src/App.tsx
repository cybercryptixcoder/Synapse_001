import React, { useMemo, useState } from "react";
import { CanvasProvider, useCanvas } from "./canvas/CanvasProvider";
import { CanvasView } from "./components/CanvasView";
import { FloatingInput } from "./components/FloatingInput";
import { useWorkerRunner } from "./hooks/useWorkerRunner";
import { useLiveSession } from "./hooks/useLiveSession";
import { Patch } from "./canvas/types";

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

  const mode: "mock" | "live" = useMemo(() => {
    const hasKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY);
    return hasKey ? "live" : "mock";
  }, []);

  useLiveSession(mode, {
    onPatches: dispatchPatches,
    onStatus: setStatus,
  });

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "canvasState.json";
    link.click();
    URL.revokeObjectURL(url);
  };

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
