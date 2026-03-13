import React from "react";
import { TextNoteComponent } from "../canvas/types";
import { renderMarkdown } from "../utils/markdown";

export const TextNote: React.FC<{ component: TextNoteComponent }> = ({ component }) => {
  return (
    <div className="card" id={component.id}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span className="badge">Note</span>
        <strong>Summary</strong>
      </div>
      <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(component.text || "") }} />
    </div>
  );
};
