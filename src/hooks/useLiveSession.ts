import { useEffect, useRef } from "react";
import { Patch } from "../canvas/types";
import { mockIntroPatches, mockPredictionPatches } from "../mock/mockSession";

type LiveHandlers = {
  onPatches: (patches: Patch[]) => void;
  onStatus?: (s: string) => void;
};

type Mode = "mock" | "live";

export function useLiveSession(mode: Mode, { onPatches, onStatus }: LiveHandlers) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (mode === "mock") {
      onStatus?.("mock-session");
      setTimeout(() => onPatches(mockIntroPatches), 300);
      setTimeout(() => onPatches(mockPredictionPatches), 1400);
      return;
    }

    onStatus?.("live-session: connecting");

    // Live path: dynamic import to avoid bundling when unused
    (async () => {
      const { createLiveSession } = await import("../../live_connector/connector");
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      if (!apiKey) {
        onStatus?.("missing-api-key");
        return;
      }
      try {
        const session = await createLiveSession(apiKey, {
          onAudio: () => {
            /* audio playback stub */
          },
          onToolCall: (_name, args: any) => {
            if (Array.isArray(args?.patches)) {
              onPatches(args.patches as Patch[]);
            }
          },
          onClose: (reason) => onStatus?.(`live-session closed: ${reason ?? "normal"}`),
        });
        onStatus?.("live-session: ready");
        // audio send stub; real mic capture should pipe pcm chunks to session.sendAudio
        return () => session.close();
      } catch (err) {
        console.error(err);
        onStatus?.("live-session error");
      }
    })();
  }, [mode, onPatches, onStatus]);
}
