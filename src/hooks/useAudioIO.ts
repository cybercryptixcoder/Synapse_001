import { useEffect, useRef } from "react";

type Options = {
  enabled: boolean;
  sendAudio?: (chunk: ArrayBuffer) => void;
  onStatus?: (s: string) => void;
};

/**
 * Captures mic audio, resamples to 16 kHz PCM16, streams to sendAudio.
 * Prefers AudioWorklet; falls back to ScriptProcessor.
 * Handles autoplay policies by resuming AudioContext on first user interaction.
 */
export function useAudioIO({ enabled, sendAudio, onStatus }: Options) {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

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

        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;

        resumeListener = () => ensureResumed(audioCtx);
        window.addEventListener("click", resumeListener, { once: true });

        const source = audioCtx.createMediaStreamSource(stream);

        // Try AudioWorklet first
        try {
          const workletBlob = new Blob(
            [
              `
              class PCM16Processor extends AudioWorkletProcessor {
                process(inputs) {
                  const input = inputs[0]?.[0];
                  if (!input) return true;
                  const pcm = new Int16Array(input.length);
                  for (let i = 0; i < input.length; i++) {
                    const s = Math.max(-1, Math.min(1, input[i]));
                    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
                  }
                  this.port.postMessage(pcm.buffer, [pcm.buffer]);
                  return true;
                }
              }
              registerProcessor('pcm16-writer', PCM16Processor);
            `,
            ],
            { type: "application/javascript" },
          );
          const url = URL.createObjectURL(workletBlob);
          await audioCtx.audioWorklet.addModule(url);
          URL.revokeObjectURL(url);

          const workletNode = new AudioWorkletNode(audioCtx, "pcm16-writer");
          workletNode.port.onmessage = (e) => {
            if (!cancelled && sendAudio) sendAudio(e.data as ArrayBuffer);
          };
          workletNodeRef.current = workletNode;

          source.connect(workletNode);
          workletNode.connect(audioCtx.destination); // silent path; processor emits only via port
          onStatus?.("mic: streaming (worklet)");
        } catch (e) {
          console.warn("AudioWorklet unavailable, falling back to ScriptProcessor", e);
          const processor = audioCtx.createScriptProcessor(2048, 1, 1);
          processorRef.current = processor;
          processor.onaudioprocess = (event) => {
            const input = event.inputBuffer.getChannelData(0); // Float32 at device sampleRate
            const pcm16 = floatToPcm16(input);
            sendAudio?.(pcm16.buffer);
          };
          source.connect(processor);
          processor.connect(audioCtx.destination);
          onStatus?.("mic: streaming (script processor)");
        }

        await ensureResumed(audioCtx);
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
      workletNodeRef.current?.disconnect();
      audioCtxRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled, sendAudio, onStatus]);
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
