import { useCallback, useEffect, useRef, useState } from "react";
import { Patch } from "../canvas/types";
import { mockIntroPatches, mockPredictionPatches } from "../mock/mockSession";

type LiveHandlers = {
  onPatches: (patches: Patch[]) => void;
  onStatus?: (s: string) => void;
  onSnapshotRequest?: (params: { reason?: string; durationMs?: number; fps?: number }) => void;
  onAudioFromModel?: (pcm: ArrayBuffer) => void;
  onInterrupted?: () => void;
  onServerError?: (message: string) => void;
  onTranscript?: (source: "user" | "model", text: string) => void;
  onDebugLog?: (level: "info" | "warn" | "error", message: string) => void;
};

type Mode = "mock" | "live";

export type LiveSessionHandle = {
  mode: Mode;
  status: string;
  sendAudio?: (chunk: ArrayBuffer) => void;
  sendText?: (text: string) => void;
  sendImage?: (base64Png: string) => void;
  setMode: (m: Mode) => void;
  sessionReady: boolean;
  wsState: string;
  retry: () => void;
};

const MOCK_DELAY_MS = 400;

const SUPPORTED_KINDS = new Set(["stepList", "codeViewer", "outputTerminal", "textNote"]);

function normalizeKind(kind: string) {
  const k = kind.toLowerCase();
  if (k === "code" || k === "codeblock" || k === "code_block" || k === "codeviewer" || k === "code_viewer") {
    return "codeViewer";
  }
  if (k === "steplist" || k === "step_list" || k === "steps") return "stepList";
  if (k === "terminal" || k === "output" || k === "output_terminal" || k === "outputterminal") {
    return "outputTerminal";
  }
  if (k === "note" || k === "text" || k === "text_note" || k === "textnote") return "textNote";
  return kind;
}

function inferKind(component: Record<string, unknown>): string | null {
  if ("code" in component || "language" in component || "highlights" in component) return "codeViewer";
  if ("steps" in component) return "stepList";
  if ("entries" in component) return "outputTerminal";
  if ("text" in component) return "textNote";
  return null;
}

function coerceStepText(raw: any): string | null {
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  if (!raw || typeof raw !== "object") return null;
  const candidates = [
    (raw as any).text,
    (raw as any).title,
    (raw as any).label,
    (raw as any).name,
    (raw as any).content,
    (raw as any).description,
    (raw as any).detail,
    (raw as any).value,
    (raw as any).step,
  ];
  for (const c of candidates) {
    if (typeof c === "string" || typeof c === "number") return String(c);
  }
  return null;
}

function normalizeStepValue(raw: any, fallbackId: string, log: (level: "info" | "warn" | "error", message: string) => void): any {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const text = coerceStepText(raw);
    if (!text) log("warn", `⚠️ step missing text for ${fallbackId}`);
    const childrenRaw =
      (raw as any).children ??
      (raw as any).substeps ??
      (raw as any).items ??
      (raw as any).steps;
    const children = Array.isArray(childrenRaw)
      ? normalizeStepsArray(childrenRaw, `${(raw as any).id ?? fallbackId}-child`, log)
      : undefined;
    return {
      id: (raw as any).id ?? fallbackId,
      text: text ?? "",
      highlight: Boolean((raw as any).highlight),
      expanded: (raw as any).expanded,
      ...(children ? { children } : {}),
    };
  }
  const text = coerceStepText(raw);
  return { id: fallbackId, text: text ?? "" };
}

function normalizeStepsArray(raw: any, baseId: string, log: (level: "info" | "warn" | "error", message: string) => void) {
  if (!Array.isArray(raw)) return [];
  return raw.map((step, idx) => normalizeStepValue(step, `${baseId}-step-${idx + 1}`, log));
}

function normalizeStepListComponent(comp: any, log: (level: "info" | "warn" | "error", message: string) => void) {
  const stepsRaw = Array.isArray(comp.steps)
    ? comp.steps
    : Array.isArray(comp.items)
      ? comp.items
      : [];
  comp.steps = normalizeStepsArray(stepsRaw, comp.id || "step", log);
}

function parseJsonMaybe(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatValueForLog(value: unknown) {
  try {
    if (typeof value === "string") {
      const trimmed = value.length > 120 ? `${value.slice(0, 117)}...` : value;
      return `"${trimmed}"`;
    }
    const json = JSON.stringify(value);
    if (!json) return String(value);
    return json.length > 200 ? `${json.slice(0, 197)}...` : json;
  } catch {
    return String(value);
  }
}

function summarizePatch(p: Patch) {
  if (p.op === "add") {
    const comp = p.component as any;
    if (comp?.kind === "stepList") {
      return `add:stepList#${comp.id} steps=${Array.isArray(comp.steps) ? comp.steps.length : 0}`;
    }
    if (comp?.kind === "codeViewer") {
      const lines = typeof comp.code === "string" ? comp.code.split("\n").length : 0;
      return `add:codeViewer#${comp.id} ${comp.language || "code"} lines=${lines}`;
    }
    if (comp?.kind === "outputTerminal") {
      return `add:outputTerminal#${comp.id} entries=${Array.isArray(comp.entries) ? comp.entries.length : 0}`;
    }
    if (comp?.kind === "textNote") {
      return `add:textNote#${comp.id}`;
    }
    return `add:${comp?.kind ?? "component"}#${comp?.id ?? "unknown"}`;
  }
  if (p.op === "update") {
    return `update:${(p as any).id} ${(p as any).path}=${formatValueForLog((p as any).value)}`;
  }
  return `remove:${(p as any).id}`;
}

function normalizePatches(
  input: unknown,
  log: (level: "info" | "warn" | "error", message: string) => void,
): Patch[] | null {
  const parsed = parseJsonMaybe(input) as any;
  const patchesRaw = Array.isArray(parsed)
    ? parsed
    : parseJsonMaybe(parsed?.patches ?? parsed?.result?.patches);
  if (!Array.isArray(patchesRaw)) {
    log("warn", "⚠️ tool args missing patches array");
    return null;
  }

  const out: Patch[] = [];
  for (const p of patchesRaw) {
    if (!p || typeof p !== "object") {
      log("warn", "⚠️ patch is not an object; skipping");
      continue;
    }
    const op = (p as any).op;
    if (op !== "add" && op !== "update" && op !== "remove") {
      log("warn", `⚠️ invalid patch op: ${String(op)}`);
      continue;
    }
    if (op === "add") {
      const comp = (p as any).component;
      if (!comp || typeof comp !== "object") {
        log("warn", "⚠️ add patch missing component");
        continue;
      }
      let kind = typeof comp.kind === "string" ? normalizeKind(comp.kind) : undefined;
      if (typeof comp.kind === "string" && kind !== comp.kind) {
        log("info", `✨ normalized kind ${comp.kind} -> ${kind}`);
      }
      if (!kind) {
        const inferred = inferKind(comp as Record<string, unknown>);
        if (inferred) {
          kind = inferred;
          log("info", `✨ inferred kind -> ${kind}`);
        }
      }
      if (!kind) {
        log("warn", "⚠️ missing component.kind and could not infer");
        continue;
      }
      comp.kind = kind;
      if (kind === "stepList") {
        normalizeStepListComponent(comp, log);
      }
      if (!SUPPORTED_KINDS.has(kind)) {
        log("warn", `⚠️ unsupported component kind: ${String(kind)}`);
      }
      if (!comp.id) {
        log("warn", "⚠️ add patch missing component.id");
        continue;
      }
      out.push({ op: "add", component: comp, after: (p as any).after });
    } else {
      const id = (p as any).id;
      if (!id) {
        log("warn", `⚠️ ${op} patch missing id`);
        continue;
      }
      if (op === "update") {
        const path = (p as any).path;
        if (typeof path === "string") {
          if (path === "/steps" && Array.isArray((p as any).value)) {
            (p as any).value = normalizeStepsArray((p as any).value, id, log);
          } else {
            const match = path.match(/^\/steps\/(\d+)$/);
            if (match) {
              const idx = Number(match[1]);
              (p as any).value = normalizeStepValue((p as any).value, `${id}-step-${idx + 1}`, log);
            }
            const childrenMatch = path.match(/^\/steps\/(\d+)\/children$/);
            if (childrenMatch && Array.isArray((p as any).value)) {
              const idx = Number(childrenMatch[1]);
              (p as any).value = normalizeStepsArray((p as any).value, `${id}-step-${idx + 1}-child`, log);
            }
            const childIndexMatch = path.match(/^\/steps\/(\d+)\/children\/(\d+)$/);
            if (childIndexMatch) {
              const stepIdx = Number(childIndexMatch[1]);
              const childIdx = Number(childIndexMatch[2]);
              (p as any).value = normalizeStepValue(
                (p as any).value,
                `${id}-step-${stepIdx + 1}-child-${childIdx + 1}`,
                log,
              );
            }
          }
        }
      }
      out.push(p as Patch);
    }
  }

  return out.length > 0 ? out : null;
}

export function useLiveSession(
  preferredMode: Mode,
  handlers: LiveHandlers,
): LiveSessionHandle {
  const [mode, setMode] = useState<Mode>(preferredMode);
  const [status, setStatus] = useState<string>("connecting");
  const [sendAudioFn, setSendAudioFn] = useState<((c: ArrayBuffer) => void) | undefined>(undefined);
  const [sendTextFn, setSendTextFn] = useState<((t: string) => void) | undefined>(undefined);
  const [sendImageFn, setSendImageFn] = useState<((b: string) => void) | undefined>(undefined);
  const liveSessionRef = useRef<{ close: () => Promise<void>; sendAudio?: (c: ArrayBuffer) => void; sendText?: (t: string) => void; sendImage?: (b: string) => void } | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [wsState, setWsState] = useState<string>("idle");

  // FIX: Store handlers in a ref so they don't trigger infinite React loops from the parent component
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const debugLog = useCallback(
    (level: "info" | "warn" | "error", message: string) => {
      handlersRef.current.onDebugLog?.(level, message);
    },
    [],
  );

  const runMock = useCallback(() => {
    setStatus("mock-session");
    handlersRef.current.onStatus?.("mock-session");
    setSendAudioFn(undefined);
    setSendTextFn(undefined);
    setSendImageFn(undefined);
    setSessionReady(false);
    setWsState("mock");
    setTimeout(() => handlersRef.current.onPatches?.(mockIntroPatches), MOCK_DELAY_MS);
    setTimeout(() => handlersRef.current.onPatches?.(mockPredictionPatches), MOCK_DELAY_MS + 900);
  }, []);

  const cleanupSession = useCallback(() => {
    liveSessionRef.current?.close().catch(() => undefined);
    liveSessionRef.current = null;
    setSendAudioFn(undefined);
    setSendTextFn(undefined);
    setSendImageFn(undefined);
    setSessionReady(false);
  }, []);

  const retry = useCallback(() => {
    cleanupSession();
    setMode("live");
  }, [cleanupSession]);

  useEffect(() => {
    let cancelled = false;

    const connectLive = async () => {
      const apiMode = ((import.meta.env.VITE_API_MODE as string | undefined) || "vertex").toLowerCase();

      const resolveProxyUrl = () => {
        const explicit =
          (import.meta.env.VITE_VERTEX_PROXY_URL as string | undefined) ||
          (import.meta.env.VITE_LIVE_PROXY_URL as string | undefined);
        if (explicit) return explicit;
        if (typeof window === "undefined") return "";
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const host = window.location.hostname || "localhost";
        const port = (import.meta.env.VITE_TOKEN_SERVER_PORT as string | undefined) || "3001";
        return `${protocol}://${host}:${port}/api/live`;
      };

      const useApiKey = apiMode === "api";
      const proxyUrl = useApiKey ? "" : resolveProxyUrl();
      const apiKey = useApiKey ? (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) : undefined;

      if (useApiKey && !apiKey) {
        setStatus("missing-api-key");
        handlersRef.current.onStatus?.("missing-api-key");
        return;
      }
      if (!useApiKey && !proxyUrl) {
        setStatus("missing-live-proxy");
        handlersRef.current.onStatus?.("missing-live-proxy");
        return;
      }

      setStatus("live-session: connecting...");
      handlersRef.current.onStatus?.("live-session: connecting...");
      setWsState("connecting");

      try {
        const createSession = useApiKey
          ? (await import("../../live_connector/connector")).createLiveSession
          : (await import("../live/vertexProxyConnector")).createLiveSession;

        let closedEarly = false;
        let setupCompleted = false;

        const markReady = () => {
          if (cancelled || closedEarly) return;
          liveSessionRef.current = session;
          setSendAudioFn(() => session.sendAudio);
          setSendTextFn(() => session.sendText);
          setSendImageFn(() => session.sendImage);
          setSessionReady(true);
          setWsState("open");
          setStatus("live-session: ready");
          handlersRef.current.onStatus?.("live-session: ready");
        };

        const session = useApiKey
          ? await createSession(apiKey as string, {
              onOpen: () => {
                if (cancelled) return;
                setWsState("open");
                debugLog("info", "🔌 live connection open (api)");
              },
              onSetupComplete: () => {
                if (cancelled) return;
                setupCompleted = true;
                markReady();
                debugLog("info", "✅ setup complete (api)");
              },
              onAudio: (pcmBuffer: ArrayBuffer) => {
                handlersRef.current.onAudioFromModel?.(pcmBuffer);
              },
              onToolCall: (name: string, args: any) => {
                debugLog("info", `🔧 tool call: ${name}`);
                if (name === "emit_canvas_patches") {
                  const normalized = normalizePatches(args, debugLog);
                  if (normalized) {
                    const summary = normalized.map((p) => summarizePatch(p)).join(", ");
                    debugLog("info", `🧩 patches (${normalized.length}): ${summary}`);
                    handlersRef.current.onPatches?.(normalized);
                  }
                }
                if (name === "request_snapshot_burst" && handlersRef.current.onSnapshotRequest) {
                  debugLog("info", "📸 snapshot requested");
                  handlersRef.current.onSnapshotRequest({
                    reason: args?.reason,
                    durationMs: (args?.duration_s ?? 8) * 1000,
                    fps: args?.fps ?? 1,
                  });
                }
              },
              onInterrupted: () => {
                handlersRef.current.onInterrupted?.();
                debugLog("info", "🛑 interrupted");
              },
              onClose: (reason: string) => {
                closedEarly = true;
                if (cancelled) return;
                setStatus(`live-session closed: ${reason ?? "normal"}`);
                handlersRef.current.onStatus?.(`live-session closed: ${reason ?? "normal"}`);
                setWsState("closed");
                setSendAudioFn(undefined);
                setSendTextFn(undefined);
                setSendImageFn(undefined);
                setSessionReady(false);
                debugLog("warn", `🔒 session closed: ${reason ?? "normal"}`);
              },
              onServerError: (message: string) => {
                handlersRef.current.onStatus?.(`server-error: ${message}`);
                handlersRef.current.onServerError?.(message);
                debugLog("error", `❌ server error: ${message}`);
              },
              onTranscript: (source: "user" | "model", text: string) => {
                handlersRef.current.onTranscript?.(source, text);
                debugLog("info", `${source === "user" ? "🎤" : "🤖"} ${text}`);
              },
            })
          : await createSession(proxyUrl, {
              onOpen: () => {
                if (cancelled) return;
                setWsState("open");
                debugLog("info", "🔌 live connection open (vertex)");
              },
              onSetupComplete: () => {
                if (cancelled) return;
                setupCompleted = true;
                markReady();
                debugLog("info", "✅ setup complete (vertex)");
              },
              onAudio: (pcmBuffer: ArrayBuffer) => {
                handlersRef.current.onAudioFromModel?.(pcmBuffer);
              },
              onToolCall: (name: string, args: any) => {
                debugLog("info", `🔧 tool call: ${name}`);
                if (name === "emit_canvas_patches") {
                  const normalized = normalizePatches(args, debugLog);
                  if (normalized) {
                    const summary = normalized.map((p) => summarizePatch(p)).join(", ");
                    debugLog("info", `🧩 patches (${normalized.length}): ${summary}`);
                    handlersRef.current.onPatches?.(normalized);
                  }
                }
                if (name === "request_snapshot_burst" && handlersRef.current.onSnapshotRequest) {
                  debugLog("info", "📸 snapshot requested");
                  handlersRef.current.onSnapshotRequest({
                    reason: args?.reason,
                    durationMs: (args?.duration_s ?? 8) * 1000,
                    fps: args?.fps ?? 1,
                  });
                }
              },
              onInterrupted: () => {
                handlersRef.current.onInterrupted?.();
                debugLog("info", "🛑 interrupted");
              },
              onClose: (reason: string) => {
                closedEarly = true;
                if (cancelled) return;
                setStatus(`live-session closed: ${reason ?? "normal"}`);
                handlersRef.current.onStatus?.(`live-session closed: ${reason ?? "normal"}`);
                setWsState("closed");
                setSendAudioFn(undefined);
                setSendTextFn(undefined);
                setSendImageFn(undefined);
                setSessionReady(false);
                debugLog("warn", `🔒 session closed: ${reason ?? "normal"}`);
              },
              onServerError: (message: string) => {
                handlersRef.current.onStatus?.(`server-error: ${message}`);
                handlersRef.current.onServerError?.(message);
                debugLog("error", `❌ server error: ${message}`);
              },
              onTranscript: (source: "user" | "model", text: string) => {
                handlersRef.current.onTranscript?.(source, text);
                debugLog("info", `${source === "user" ? "🎤" : "🤖"} ${text}`);
              },
            });

        // Guard against race: if onclose already fired, don't mark as ready
        if (cancelled || closedEarly) {
          if (!closedEarly) session.close();
          return;
        }

        // Fallback: if setupComplete hasn't fired yet (may come in onmessage after await),
        // mark ready now — audio may already be flowing
        if (!setupCompleted) {
          markReady();
        }
      } catch (err) {
        console.error(err);
        setStatus(`live-session error (${useApiKey ? "api" : "vertex"})`);
        handlersRef.current.onStatus?.(`live-session error (${useApiKey ? "api" : "vertex"})`);
        setWsState("error");
        setSessionReady(false);
      }
    };

    if (mode === "mock") {
      runMock();
    } else {
      connectLive();
    }

    return () => {
      cancelled = true;
      cleanupSession();
    };
  }, [cleanupSession, mode, runMock]);

  return { mode, status, sendAudio: sessionReady ? sendAudioFn : undefined, sendText: sessionReady ? sendTextFn : undefined, sendImage: sessionReady ? sendImageFn : undefined, setMode, sessionReady, wsState, retry };
}
