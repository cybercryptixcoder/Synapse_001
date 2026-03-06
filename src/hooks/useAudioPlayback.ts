import { useEffect, useRef } from "react";

const MODEL_SAMPLE_RATE = 24000; // Gemini Live typically returns 24 kHz PCM16

/**
 * Audio playback scheduler: chains chunks back-to-back on a single AudioContext,
 * eliminating jitter from rapid small buffers. Supports barge-in via clear().
 */
export function useAudioPlayback(enabled: boolean, onStatus?: (s: string) => void) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nextStartRef = useRef<number>(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const resumeAttachedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const ctx = new AudioContext({ sampleRate: MODEL_SAMPLE_RATE });
    ctxRef.current = ctx;
    nextStartRef.current = ctx.currentTime;

    const tryResume = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    };
    if (!resumeAttachedRef.current) {
      window.addEventListener("click", tryResume, { once: true });
      resumeAttachedRef.current = true;
    }

    return () => {
      sourcesRef.current.forEach((s) => {
        try {
          s.stop();
        } catch {
          /* ignore */
        }
      });
      sourcesRef.current = [];
      ctx.close();
      ctxRef.current = null;
      resumeAttachedRef.current = false;
    };
  }, [enabled]);

  const enqueue = (pcm: ArrayBuffer) => {
    if (!enabled) return;
    const ctx = ctxRef.current;
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => undefined);
    }

    const int16 = new Int16Array(pcm);
    if (int16.length === 0) return;

    const floatData = int16ToFloat32(int16);
    const audioBuffer = ctx.createBuffer(1, floatData.length, MODEL_SAMPLE_RATE);
    audioBuffer.copyToChannel(floatData, 0, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== source);
    };

    // Chain back-to-back
    const now = ctx.currentTime;
    if (nextStartRef.current < now) nextStartRef.current = now;
    source.start(nextStartRef.current);
    nextStartRef.current += audioBuffer.duration;
    sourcesRef.current.push(source);
    onStatus?.("audio: playing");
  };

  const clear = () => {
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    });
    sourcesRef.current = [];
    if (ctxRef.current) {
      nextStartRef.current = ctxRef.current.currentTime;
    }
    onStatus?.("audio: cleared");
  };

  return { enqueue, clear };
}

function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}
