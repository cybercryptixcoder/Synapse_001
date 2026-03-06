import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveServerMessage } from '@google/genai';

export interface GeminiLiveOptions {
    apiKey: string;
    onAudioData: (base64Audio: string) => void;
    onTextData: (text: string) => void;
    onInterrupted: () => void;
    onStatusChange: (status: 'idle' | 'listening' | 'speaking' | 'error', errorMsg?: string) => void;
}

export class GeminiLiveClient {
    private ai: GoogleGenAI;
    private session: any = null;
    private options: GeminiLiveOptions;
    private isSpeaking = false;

    constructor(options: GeminiLiveOptions) {
        this.options = options;
        this.ai = new GoogleGenAI({
            apiKey: options.apiKey,
        });
    }

    public async connect() {
        try {
            // Use the native audio preview model for the Developer API
            const modelName = 'gemini-2.5-flash-native-audio-preview-12-2025';

            this.session = await this.ai.live.connect({
                model: modelName,
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: 'You are a helpful, witty, and concise voice assistant.',
                },
                callbacks: {
                    onopen: () => {
                        console.log('Connected to Gemini Live API');
                        this.options.onStatusChange('listening');
                    },
                    onmessage: (message: LiveServerMessage) => {
                        this.handleMessage(message);
                    },
                    onerror: (err: ErrorEvent) => {
                        console.error('Gemini connection error', err);
                        this.options.onStatusChange('error', err?.message || 'Connection error');
                    },
                    onclose: (event: CloseEvent) => {
                        console.log('WebSocket connection closed.', event);
                        this.options.onStatusChange('idle');
                    },
                },
            });

            console.log('Live session object:', this.session);
        } catch (e: any) {
            console.error('Failed to connect to Gemini Live', e);
            this.options.onStatusChange('error', e.message || 'Failed to connect');
        }
    }

    public disconnect() {
        if (this.session) {
            if (typeof this.session.close === 'function') {
                this.session.close();
            }
            this.session = null;
            this.options.onStatusChange('idle');
        }
    }

    public sendAudio(base64Pcm: string) {
        if (!this.session) return;
        try {
            // Send realtime audio using the correct SDK signature
            this.session.sendRealtimeInput({
                audio: {
                    data: base64Pcm,
                    mimeType: 'audio/pcm;rate=16000',
                },
            });
        } catch (e) {
            console.error('Error sending audio to Gemini', e);
        }
    }

    private handleMessage(message: LiveServerMessage) {
        const serverContent = message.serverContent;
        if (!serverContent) return;

        // 1. Handle barge-in (user interrupted the AI)
        if (serverContent.interrupted) {
            console.log('Barge-in detected — clearing audio queue');
            this.isSpeaking = false;
            this.options.onInterrupted();
            this.options.onStatusChange('listening');
        }

        // 2. Handle incoming audio/text chunks
        if (serverContent.modelTurn && serverContent.modelTurn.parts) {
            let textResult = '';
            let audioParts = 0;

            for (const part of serverContent.modelTurn.parts) {
                if (part.text) {
                    textResult += part.text;
                }
                if (part.inlineData && part.inlineData.data) {
                    audioParts++;
                    this.options.onAudioData(part.inlineData.data);
                }
            }

            if (textResult) {
                this.options.onTextData(textResult);
            }

            if (audioParts > 0 && !this.isSpeaking) {
                this.isSpeaking = true;
                this.options.onStatusChange('speaking');
            }
        }

        // 3. Handle turn complete
        if (serverContent.turnComplete) {
            this.isSpeaking = false;
            this.options.onStatusChange('listening');
        }
    }
}
