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
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      if (!apiKey) {
        setStatus("missing-api-key");
        handlersRef.current.onStatus?.("missing-api-key");
        return;
      }

      setStatus("live-session: connecting...");
      handlersRef.current.onStatus?.("live-session: connecting...");
      setWsState("connecting");

      try {
        const { createLiveSession } = await import("../../live_connector/connector");

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

        const session = await createLiveSession(apiKey, {
          onOpen: () => {
            if (cancelled) return;
            setWsState("open");
          },
          onSetupComplete: () => {
            if (cancelled) return;
            setupCompleted = true;
            markReady();
          },
          onAudio: (pcmBuffer) => {
            handlersRef.current.onAudioFromModel?.(pcmBuffer);
          },
          onToolCall: (name, args: any) => {
            if (name === "emit_canvas_patches" && Array.isArray(args?.patches)) {
              handlersRef.current.onPatches?.(args.patches as Patch[]);
            }
            if (name === "request_snapshot_burst" && handlersRef.current.onSnapshotRequest) {
              handlersRef.current.onSnapshotRequest({
                reason: args?.reason,
                durationMs: (args?.duration_s ?? 8) * 1000,
                fps: args?.fps ?? 1,
              });
            }
          },
          onInterrupted: () => {
            handlersRef.current.onInterrupted?.();
          },
          onClose: (reason) => {
            closedEarly = true;
            if (cancelled) return;
            setStatus(`live-session closed: ${reason ?? "normal"}`);
            handlersRef.current.onStatus?.(`live-session closed: ${reason ?? "normal"}`);
            setWsState("closed");
            setSendAudioFn(undefined);
            setSendTextFn(undefined);
            setSendImageFn(undefined);
            setSessionReady(false);
          },
          onServerError: (message) => {
            handlersRef.current.onStatus?.(`server-error: ${message}`);
            handlersRef.current.onServerError?.(message);
          },
          onTranscript: (source, text) => {
            handlersRef.current.onTranscript?.(source, text);
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
        setStatus("live-session error");
        handlersRef.current.onStatus?.("live-session error");
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
