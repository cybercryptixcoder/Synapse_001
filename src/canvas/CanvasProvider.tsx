import React, { createContext, useContext, useReducer } from "react";
import { CanvasState, Patch } from "./types";
import { applyPatches, initialCanvasState } from "./reducer";

type CanvasContextType = {
  state: CanvasState;
  dispatchPatches: (patches: Patch[]) => void;
};

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(applyPatches, initialCanvasState);

  const dispatchPatches = (patches: Patch[]) => {
    dispatch(patches);
  };

  return <CanvasContext.Provider value={{ state, dispatchPatches }}>{children}</CanvasContext.Provider>;
};

export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used within CanvasProvider");
  return ctx;
}
