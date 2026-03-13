import React from "react";
import { StepListComponent, Step } from "../canvas/types";
import { renderMarkdownInline } from "../utils/markdown";

function StepItem({ step, depth = 0 }: { step: Step; depth?: number }) {
  return (
    <li style={{ paddingLeft: depth ? depth * 12 : 0 }}>
      <span
        style={{ fontWeight: step.highlight ? 700 : 500 }}
        dangerouslySetInnerHTML={{ __html: renderMarkdownInline(step.text) }}
      />
      {step.children && step.children.length > 0 && (
        <ul>
          {step.children.map((child) => (
            <StepItem key={child.id} step={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export const StepList: React.FC<{ component: StepListComponent }> = ({ component }) => {
  return (
    <div className="card step-list" id={component.id}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span className="badge">Steps</span>
        <strong>{component.title || "Step list"}</strong>
      </div>
      <ul>
        {component.steps.map((step) => (
          <StepItem key={step.id} step={step} />
        ))}
      </ul>
    </div>
  );
};
