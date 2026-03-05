import { useEffect, useRef } from "react";

const MODEL_SAMPLE_RATE = 24000; // Gemini Live typically returns 24 kHz PCM16
const MAX_QUEUE = 5;

/**
 * Audio playback queue with tiny jitter buffer and autoplay-resume handling.
 */
export function useAudioPlayback(enabled: boolean, onStatus?: (s: string) => void) {
  const ctxRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const playingRef = useRef(false);
  const resumeAttachedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const tryResume = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    };
    if (!resumeAttachedRef.current) {
      window.addEventListener("click", tryResume, { once: true });
      resumeAttachedRef.current = true;
    }
    return () => {
      ctx.close();
      ctxRef.current = null;
      queueRef.current = [];
      playingRef.current = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (playingRef.current) return;
      const buf = queueRef.current.shift();
      if (!buf || !ctxRef.current) return;
      const floatData = int16ToFloat32(new Int16Array(buf));
      const audioBuffer = ctxRef.current.createBuffer(1, floatData.length, MODEL_SAMPLE_RATE);
      audioBuffer.copyToChannel(floatData, 0, 0);
      const source = ctxRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.onended = () => {
        playingRef.current = false;
      };
      playingRef.current = true;
      source.connect(ctxRef.current.destination);
      source.start();
      onStatus?.("audio: playing");
    };
    const interval = setInterval(tick, 20);
    return () => clearInterval(interval);
  }, [enabled, onStatus]);

  const enqueue = (pcm: ArrayBuffer) => {
    if (!enabled) return;
    // Avoid runaway queue
    if (queueRef.current.length >= MAX_QUEUE) {
      queueRef.current.shift();
      onStatus?.("audio: dropped old chunk");
    }
    queueRef.current.push(pcm);
    onStatus?.("audio: queued");
    if (ctxRef.current?.state === "suspended") {
      ctxRef.current.resume().catch(() => undefined);
    }
  };

  return { enqueue };
}

function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}
