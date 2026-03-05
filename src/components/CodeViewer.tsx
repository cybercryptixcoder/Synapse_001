import React from "react";
import { CodeViewerComponent } from "../canvas/types";
import clsx from "clsx";

export const CodeViewer: React.FC<{ component: CodeViewerComponent }> = ({ component }) => {
  return (
    <div className="card" id={component.id}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span className="badge">Code</span>
        <strong>{component.language}</strong>
      </div>
      <div className="code-viewer">
        {component.code.split("\n").map((line, idx) => {
          const lineNumber = idx + 1;
          const highlighted = component.highlights?.some(
            (r) => lineNumber >= r.startLine && lineNumber <= r.endLine,
          );
          return (
            <div key={idx} className={clsx({ highlighted })} style={{ background: highlighted ? "#1d2a44" : "transparent" }}>
              <span style={{ color: "#94a3b8", width: 32, display: "inline-block" }}>{lineNumber}</span>
              <span>{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
