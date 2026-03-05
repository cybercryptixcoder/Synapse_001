import React from "react";
import { TextNoteComponent } from "../canvas/types";

export const TextNote: React.FC<{ component: TextNoteComponent }> = ({ component }) => {
  return (
    <div className="card" id={component.id}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span className="badge">Note</span>
        <strong>Summary</strong>
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>{component.text}</div>
    </div>
  );
};
