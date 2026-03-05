import { useCallback, useEffect, useRef, useState } from "react";
import { Patch } from "../canvas/types";
import { mockIntroPatches, mockPredictionPatches } from "../mock/mockSession";

type LiveHandlers = {
  onPatches: (patches: Patch[]) => void;
  onStatus?: (s: string) => void;
  onSnapshotRequest?: (params: { reason?: string; durationMs?: number; fps?: number }) => void;
  onAudioFromModel?: (pcm: ArrayBuffer) => void;
};

type Mode = "mock" | "live";

export type LiveSessionHandle = {
  mode: Mode;
  status: string;
  sendAudio?: (chunk: ArrayBuffer) => void;
  setMode: (m: Mode) => void;
};

const MOCK_DELAY_MS = 400;

export function useLiveSession(
  preferredMode: Mode,
  handlers: LiveHandlers,
): LiveSessionHandle {
  const [mode, setMode] = useState<Mode>(preferredMode);
  const [status, setStatus] = useState<string>("connecting");
  const [sendAudioFn, setSendAudioFn] = useState<((c: ArrayBuffer) => void) | undefined>(undefined);
  const liveSessionRef = useRef<{ close: () => Promise<void>; sendAudio?: (c: ArrayBuffer) => void } | null>(null);

  // FIX: Store handlers in a ref so they don't trigger infinite React loops from the parent component
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const runMock = useCallback(() => {
    setStatus("mock-session");
    handlersRef.current.onStatus?.("mock-session");
    setSendAudioFn(undefined);
    setTimeout(() => handlersRef.current.onPatches?.(mockIntroPatches), MOCK_DELAY_MS);
    setTimeout(() => handlersRef.current.onPatches?.(mockPredictionPatches), MOCK_DELAY_MS + 900);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const connectLive = async () => {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      if (!apiKey) {
        setStatus("missing-api-key");
        handlersRef.current.onStatus?.("missing-api-key");
        setMode("mock");
        if (!cancelled) runMock();
        return;
      }
      
      setStatus("live-session: connecting...");
      handlersRef.current.onStatus?.("live-session: connecting...");

      try {
        const { createLiveSession } = await import("../../live_connector/connector");
        
        const session = await createLiveSession(apiKey, {
          onAudio: (pcmBuffer) => {
            // Forward audio safely to your builder's useAudioIO hook!
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
          onClose: (reason) => {
            if (cancelled) return;
            setStatus(`live-session closed: ${reason ?? "normal"}`);
            handlersRef.current.onStatus?.(`live-session closed: ${reason ?? "normal"}`);
            setMode("mock");
            runMock();
          },
        });

        if (cancelled) {
          session.close();
          return;
        }

        liveSessionRef.current = session;
        setSendAudioFn(() => session.sendAudio);
        
        setStatus("live-session: ready");
        handlersRef.current.onStatus?.("live-session: ready");
      } catch (err) {
        console.error(err);
        setStatus("live-session error; falling back to mock");
        handlersRef.current.onStatus?.("live-session error; falling back to mock");
        setMode("mock");
        if (!cancelled) runMock();
      }
    };

    if (mode === "mock") {
      runMock();
    } else {
      connectLive();
    }

    return () => {
      cancelled = true;
      liveSessionRef.current?.close().catch(() => undefined);
      setSendAudioFn(undefined);
    };
  }, [mode, runMock]); // The dependency array is safely isolated now.

  return { mode, status, sendAudio: sendAudioFn, setMode };
}