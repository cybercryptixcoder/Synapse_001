import React from "react";
import { OutputTerminalComponent } from "../canvas/types";
import clsx from "clsx";

export const OutputTerminal: React.FC<{ component: OutputTerminalComponent }> = ({ component }) => {
  const color = (kind: string) =>
    kind === "stderr" ? "#fca5a5" : kind === "info" ? "#67e8f9" : "#a5f3fc";
  return (
    <div className="card" id={component.id}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span className="badge">Output</span>
        <strong>Terminal</strong>
      </div>
      <div className="terminal">
        {component.entries.map((entry, idx) => (
          <div
            key={idx}
            className={clsx("terminal-line")}
            style={{ color: color(entry.kind), whiteSpace: "pre-wrap" }}
          >
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
};
