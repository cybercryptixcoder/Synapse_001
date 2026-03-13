import React, { useState } from "react";

type LogLevel = "info" | "warn" | "error";

export type DevLog = {
  ts: number;
  level: LogLevel;
  message: string;
};

type Props = {
  logs: DevLog[];
  onClear?: () => void;
};

export const DevTerminal: React.FC<Props> = ({ logs, onClear }) => {
  const [collapsed, setCollapsed] = useState(false);

  const copyAll = async () => {
    const text = logs
      .map((l) => `${new Date(l.ts).toISOString()} [${l.level}] ${l.message}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text || "(no logs)");
    } catch (e) {
      console.error("Clipboard copy failed", e);
    }
  };

  if (collapsed) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#0f172a",
          color: "#e2e8f0",
          borderRadius: 8,
          padding: "8px 10px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
          fontSize: 12,
          zIndex: 999,
        }}
      >
        <div style={{ fontWeight: 700 }}>Dev Terminal</div>
        <div style={{ opacity: 0.7 }}>({logs.length} logs)</div>
        <button
          onClick={() => setCollapsed(false)}
          style={{
            border: "1px solid #334155",
            background: "#1e293b",
            color: "#e2e8f0",
            padding: "4px 8px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Expand
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        width: "420px",
        maxHeight: "40vh",
        overflow: "auto",
        background: "#0f172a",
        color: "#e2e8f0",
        borderRadius: 8,
        padding: "10px 10px 6px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
        fontSize: 12,
        zIndex: 999,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 700 }}>Dev Terminal (live logs)</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setCollapsed(true)}
            style={{
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e2e8f0",
              padding: "4px 8px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Collapse
          </button>
          <button
            onClick={copyAll}
            style={{
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e2e8f0",
              padding: "4px 8px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Copy
          </button>
          <button
            onClick={onClear}
            style={{
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e2e8f0",
              padding: "4px 8px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      </div>
      {logs.length === 0 ? (
        <div style={{ opacity: 0.6 }}>No logs yet.</div>
      ) : (
        logs.map((log, idx) => (
          <div key={idx} style={{ marginBottom: 4, whiteSpace: "pre-wrap" }}>
            <span style={{ opacity: 0.6 }}>{new Date(log.ts).toLocaleTimeString()}</span>{" "}
            <span style={{ color: levelColor(log.level) }}>[{log.level}]</span>{" "}
            <span>{log.message}</span>
          </div>
        ))
      )}
    </div>
  );
};

function levelColor(level: LogLevel) {
  switch (level) {
    case "error":
      return "#fca5a5";
    case "warn":
      return "#fbbf24";
    default:
      return "#a5f3fc";
  }
}
