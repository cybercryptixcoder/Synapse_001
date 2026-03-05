#!/usr/bin/env bash
set -euo pipefail

python3 "$(dirname "$0")/run_harness.py" --validate-goldens
python3 "$(dirname "$0")/run_harness.py" \
  --session "$(dirname "$0")/artifacts/sample_merge_sort_session.jsonl" \
  --golden merge_sort_walkthrough
