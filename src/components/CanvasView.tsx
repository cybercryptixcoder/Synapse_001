import React from "react";
import { useCanvas } from "../canvas/CanvasProvider";
import { StepList } from "./StepList";
import { CodeViewer } from "./CodeViewer";
import { OutputTerminal } from "./OutputTerminal";
import { TextNote } from "./TextNote";
import { Component } from "../canvas/types";

export const CanvasView: React.FC = () => {
  const { state } = useCanvas();

  const renderComponent = (component: Component) => {
    switch (component.kind) {
      case "stepList":
        return <StepList component={component} />;
      case "codeViewer":
        return <CodeViewer component={component} />;
      case "outputTerminal":
        return <OutputTerminal component={component} />;
      case "textNote":
        return <TextNote component={component} />;
      default:
        return null;
    }
  };

  return (
    <div className="canvas">
      {state.order.map((id) => {
        const comp = state.components[id];
        if (!comp) return null;
        return <React.Fragment key={id}>{renderComponent(comp)}</React.Fragment>;
      })}
    </div>
  );
};
