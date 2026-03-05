import { useEffect, useRef } from "react";

type Options = {
  enabled: boolean;
  sendAudio?: (chunk: ArrayBuffer) => void;
  onStatus?: (s: string) => void;
};

/**
 * Captures mic audio, resamples to 16 kHz PCM16, streams to sendAudio.
 * Handles autoplay policies by resuming AudioContext on first user interaction.
 */
export function useAudioIO({ enabled, sendAudio, onStatus }: Options) {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    if (!enabled || !sendAudio) return;

    let cancelled = false;
    let resumeListener: (() => void) | null = null;

    const ensureResumed = async (ctx: AudioContext) => {
      if (ctx.state === "running") return;
      try {
        await ctx.resume();
        onStatus?.("mic: context resumed");
      } catch (e) {
        console.warn("AudioContext resume failed", e);
      }
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) return;
        mediaStreamRef.current = stream;

        const audioCtx = new AudioContext(); // use device rate, resample in code
        audioCtxRef.current = audioCtx;

        resumeListener = () => ensureResumed(audioCtx);
        window.addEventListener("click", resumeListener, { once: true });

        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0); // Float32 at device sampleRate
          const pcm16 = resampleTo16k(input, audioCtx.sampleRate);
          sendAudio(pcm16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
        await ensureResumed(audioCtx);
        onStatus?.("mic: streaming");
      } catch (err) {
        console.error(err);
        onStatus?.("mic: error/denied");
      }
    };

    start();

    return () => {
      cancelled = true;
      if (resumeListener) window.removeEventListener("click", resumeListener);
      processorRef.current?.disconnect();
      audioCtxRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled, sendAudio, onStatus]);
}

function resampleTo16k(input: Float32Array, inputRate: number): Int16Array {
  const targetRate = 16000;
  if (inputRate === targetRate) {
    return floatToPcm16(input);
  }
  const ratio = inputRate / targetRate;
  const outLength = Math.round(input.length / ratio);
  const output = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = idx - i0;
    const sample = input[i0] * (1 - frac) + input[i1] * frac;
    output[i] = floatSampleToInt16(sample);
  }
  return output;
}

function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = floatSampleToInt16(input[i]);
  return out;
}

function floatSampleToInt16(s: number) {
  const clamped = Math.max(-1, Math.min(1, s));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
}
