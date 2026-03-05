import { useCallback, useRef, useState } from "react";

type BurstOptions = {
  durationMs?: number;
  fps?: number;
  reason?: string;
  targetSelector?: string;
  onStatus?: (s: string) => void;
  onCapture?: (blob: Blob) => void;
};

const DEFAULT_DURATION = 8000;
const DEFAULT_FPS = 1;
const COOLDOWN_MS = 20000;

/**
 * Handles html2canvas snapshot bursts on demand with cooldown.
 * Uses dynamic import to avoid bundling cost if never used.
 */
export function useSnapshotBurst() {
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (burstTimer.current) clearTimeout(burstTimer.current);
    if (frameTimer.current) clearInterval(frameTimer.current as any);
    burstTimer.current = null;
    frameTimer.current = null;
  };

  const startBurst = useCallback(
    async (opts: BurstOptions = {}) => {
      const now = Date.now();
      if (now < cooldownUntil) {
        opts.onStatus?.("snapshot skipped (cooldown)");
        return;
      }

      const duration = opts.durationMs ?? DEFAULT_DURATION;
      const fps = opts.fps ?? DEFAULT_FPS;
      const interval = Math.max(1000 / fps, 200);
      const targetSelector = opts.targetSelector ?? "#root";

      const targetEl = document.querySelector(targetSelector) as HTMLElement | null;
      if (!targetEl) {
        opts.onStatus?.("snapshot target not found");
        return;
      }

      const html2canvas = (await import("html2canvas")).default;

      opts.onStatus?.(`snapshot burst start (${opts.reason ?? "unspecified"})`);

      frameTimer.current = setInterval(async () => {
        try {
          const canvas = await html2canvas(targetEl, { scale: 1, backgroundColor: "#ffffff" });
          // Downscale to ~480p if larger
          const maxWidth = 480;
          const scale = Math.min(1, maxWidth / canvas.width);
          const outCanvas = document.createElement("canvas");
          outCanvas.width = canvas.width * scale;
          outCanvas.height = canvas.height * scale;
          const ctx = outCanvas.getContext("2d");
          if (ctx) ctx.drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);
          outCanvas.toBlob((blob) => {
            if (blob && opts.onCapture) opts.onCapture(blob);
          }, "image/png");
        } catch (err) {
          opts.onStatus?.("snapshot capture failed");
          console.error(err);
        }
      }, interval) as any;

      burstTimer.current = setTimeout(() => {
        clearTimers();
        setCooldownUntil(Date.now() + COOLDOWN_MS);
        opts.onStatus?.("snapshot burst end");
      }, duration) as any;
    },
    [cooldownUntil],
  );

  return { startBurst, clearTimers, cooldownUntil };
}
