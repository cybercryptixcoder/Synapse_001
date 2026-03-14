# Prompt Harness

Validates Synapse System Prompt v1.0 behavior using golden dialogues and session logs.

## Files
- `../v1.1.txt` - system prompt.
- `golden_dialogues/` - expected event skeletons (5 cases).
- `artifacts/sample_merge_sort_session.jsonl` - example log that should pass `merge_sort_walkthrough` checks.
- `run_harness.py` - assertion runner.

## Log format (JSONL)
Each line represents one event:
- Speech: `{ "type": "speech", "role": "assistant|user", "text": "..." }`
- Tool call: `{ "type": "tool_call", "name": "emit_canvas_patches|request_snapshot_burst", "arguments": { ... } }`

## Assertions
1) Assistant speech contains no code tokens (heuristic regex).
2) Tool calls match schema; IDs must be added before update/remove.
3) Every tool call is preceded by an assistant speech since the last tool call.
4) Optional: session follows a golden's event skeleton (type/order/name).

## Golden dialogues
- merge_sort_walkthrough
- code_prediction
- barge_in_mid_sentence
- wrong_id_correction
- snapshot_request

## Usage
```bash
# Validate goldens only
python prompt/harness/run_harness.py --validate-goldens

# Check a session log against merge_sort_walkthrough golden
python prompt/harness/run_harness.py \
  --session prompt/harness/artifacts/sample_merge_sort_session.jsonl \
  --golden merge_sort_walkthrough
```

Exit code 0 = pass; non-zero = fail. Integrate this script as a CI gate after running Live emulator replays.
