export type ComponentId = string;

export type Step = {
  id: string;
  text: string;
  expanded?: boolean;
  children?: Step[];
  highlight?: boolean;
};

export type HighlightRange = { startLine: number; endLine: number };

export type StepListComponent = {
  kind: "stepList";
  id: ComponentId;
  title?: string;
  steps: Step[];
};

export type CodeViewerComponent = {
  kind: "codeViewer";
  id: ComponentId;
  language: string;
  code: string;
  highlights?: HighlightRange[];
};

export type TerminalEntry = {
  kind: "stdout" | "stderr" | "info";
  text: string;
};

export type OutputTerminalComponent = {
  kind: "outputTerminal";
  id: ComponentId;
  entries: TerminalEntry[];
};

export type TextNoteComponent = {
  kind: "textNote";
  id: ComponentId;
  text: string;
};

export type Component =
  | StepListComponent
  | CodeViewerComponent
  | OutputTerminalComponent
  | TextNoteComponent;

export type CanvasState = {
  components: Record<ComponentId, Component>;
  order: ComponentId[];
  meta?: { lastUpdated?: number; hash?: string };
};

export type Patch =
  | { op: "add"; component: Component; after?: ComponentId }
  | { op: "update"; id: ComponentId; path: string; value: unknown }
  | { op: "remove"; id: ComponentId };
