// audio-utils.ts

/**
 * Converts a base64 string directly into an Int16Array.
 */
export function base64ToInt16Array(base64: string): Int16Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/**
 * Converts a Float32Array of audio data to Int16 PCM Base64.
 */
export function encodeMonoAudioToBase64(float32Array: Float32Array): string {
  const buffer = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const bytes = new Uint8Array(buffer.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

/**
 * Class to handle PCM audio playback queue from the Live API.
 * Supports barge-in by tracking and cancelling scheduled audio sources.
 */
export class AudioStreamPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  constructor() {
    this.init();
  }

  private init() {
    // Gemini output is 24kHz PCM
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
    this.nextStartTime = this.audioCtx.currentTime;
  }

  public async playPCM(base64: string) {
    if (!this.audioCtx) return;

    // Resume context if suspended (browser autoplay policy)
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const int16Array = base64ToInt16Array(base64);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 0x8000;
    }

    const audioBuffer = this.audioCtx.createBuffer(
      1, // mono
      float32Array.length,
      24000, // 24kHz sample rate from Gemini
    );

    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioCtx.destination);

    // Track active sources for barge-in cancellation
    this.activeSources.push(source);
    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) this.activeSources.splice(idx, 1);
    };

    // Schedule playback seamlessly
    const currentTime = this.audioCtx.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  /**
   * Clear the playback queue — used for barge-in.
   * Stops all scheduled audio sources immediately without destroying the context.
   */
  public clearQueue() {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Already stopped — ignore
      }
    }
    this.activeSources = [];
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
  }

  /**
   * Full stop — clears queue and tears down the AudioContext.
   */
  public stop() {
    this.clearQueue();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
