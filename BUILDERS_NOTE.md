# Builder Reference Notes (Gemini Live 2.5 Native Audio Preview)

**Source:** user-provided builder findings (2026-03). Keep for future troubleshooting.

## Payload shapes (wire format)
- **Connect (setup)**  
  ```json
  {
    "setup": {
      "model": "models/gemini-2.5-flash-native-audio-preview-12-2025",
      "generation_config": {
        "response_modalities": ["AUDIO"],
        "speech_config": {
          "voice_config": { "prebuilt_voice_config": { "voice_name": "Aoede" } }
        }
      },
      "tools": [{ "function_declarations": [ /* ... */ ] }]
    }
  }
  ```

- **Send audio (realtime input)**  
  ```json
  {
    "realtime_input": {
      "media_chunks": [
        { "mime_type": "audio/pcm;rate=16000", "data": "<BASE64_PCM_LE_16k>" }
      ]
    }
  }
  ```

- **Tool response**  
  ```json
  {
    "tool_response": {
      "function_responses": [
        { "id": "<call_id>", "name": "<function_name>", "response": { "result": { /* payload */ } } }
      ]
    }
  }
  ```

## Close codes & common causes
- **1011 Internal Error:** often due to tool response/id mismatch or multiple tool calls without proper responses. Ensure `function_responses[].id` matches the call id exactly.
- **1007 Invalid Payload:** audio not strictly 16 kHz PCM16 LE. Downsample before sending.
- **1008 Policy Violation:** unsupported feature (e.g., NON_BLOCKING tools) or key scope issue. Use blocking tools.
- **1000 Normal Closure:** session timeout (~15 min) if context compression isn’t enabled.

## Critical caveats
- Do NOT set NON_BLOCKING behavior for tools on this model (hallucination/early speak bug).
- Audio format is strict: PCM16, 16 kHz, little-endian. Avoid 44.1/48 kHz or encoded formats.
- Send small audio chunks (20–40 ms); avoid blocking the event loop during tool handling.
- If the server sends `{"interrupted": true}`, immediately clear playback/buffers (barge-in).

