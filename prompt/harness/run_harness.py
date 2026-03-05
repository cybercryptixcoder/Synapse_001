#!/usr/bin/env python3
"""
Prompt validation harness for Synapse System Prompt v1.0.

Usage:
  python prompt/harness/run_harness.py --session path/to/session.jsonl --golden merge_sort_walkthrough
  python prompt/harness/run_harness.py --validate-goldens   # schema sanity only

Session log format (JSONL): each line is an object with:
  type: "speech" | "tool_call"
  role: "assistant" | "user"   (required for speech)
  text: string                  (required for speech)
  name: string                  (required for tool_call)
  arguments: object             (required for tool_call)

Assertions enforced:
  1) Assistant speech must not contain code tokens (heuristic detector).
  2) Tool calls match schema; IDs are added before update/remove.
  3) Each tool call must be preceded by an assistant speech since the last tool call.
  4) If a golden is provided, the session must follow its event skeleton (type/order/name).
"""

import argparse
import json
import pathlib
import re
import sys
from typing import Any, Dict, List

ROOT = pathlib.Path(__file__).resolve().parent
GOLDEN_DIR = ROOT / "golden_dialogues"

CODE_REGEX = re.compile(r"```|\b(function|const|let|var|def|class)\b|=>|;\s*$|{\s*}|</?\w+>", re.MULTILINE)


def load_json(path: pathlib.Path) -> Any:
    with path.open() as f:
        return json.load(f)


def load_jsonl(path: pathlib.Path) -> List[Dict[str, Any]]:
    events = []
    with path.open() as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSON on line {line_num} in {path}: {exc}") from exc
    return events


def list_goldens() -> Dict[str, Dict[str, Any]]:
    goldens = {}
    for path in GOLDEN_DIR.glob("*.json"):
        data = load_json(path)
        name = data.get("name")
        if not name:
            raise ValueError(f"Golden file {path} missing 'name'")
        goldens[name] = data
    return goldens


def assert_no_code_speech(events: List[Dict[str, Any]]) -> List[str]:
    issues = []
    for i, ev in enumerate(events):
        if ev.get("type") != "speech" or ev.get("role") != "assistant":
            continue
        text = ev.get("text", "")
        if CODE_REGEX.search(text):
            issues.append(f"Speech appears to contain code (event {i+1}): {text[:60]}...")
    return issues


def validate_tool_call(event: Dict[str, Any], known_ids: set) -> List[str]:
    issues = []
    name = event.get("name")
    args = event.get("arguments", {})
    if name == "emit_canvas_patches":
        patches = args.get("patches")
        if not isinstance(patches, list) or not patches:
            issues.append("emit_canvas_patches missing non-empty 'patches'")
            return issues
        for patch in patches:
            op = patch.get("op")
            if op not in {"add", "update", "remove"}:
                issues.append(f"Invalid patch op: {op}")
                continue
            if op == "add":
                comp = patch.get("component")
                cid = comp.get("id") if isinstance(comp, dict) else None
                if not cid or not isinstance(cid, str):
                    issues.append("Add patch missing component.id")
                if cid in known_ids:
                    issues.append(f"Component id '{cid}' added twice")
                if cid:
                    known_ids.add(cid)
            else:  # update/remove
                cid = patch.get("id")
                if not cid or not isinstance(cid, str):
                    issues.append(f"{op} patch missing id")
                elif cid not in known_ids:
                    issues.append(f"{op} patch references unknown id '{cid}'")
    elif name == "request_snapshot_burst":
        reason = args.get("reason")
        if not reason:
            issues.append("request_snapshot_burst missing reason")
    else:
        issues.append(f"Unknown tool name: {name}")
    return issues


def assert_tool_speech_order(events: List[Dict[str, Any]]) -> List[str]:
    issues = []
    spoke_since_tool = False
    seen_assistant_speech = False
    for idx, ev in enumerate(events):
        if ev.get("type") == "speech" and ev.get("role") == "assistant":
            spoke_since_tool = True
            seen_assistant_speech = True
        if ev.get("type") == "tool_call":
            if not spoke_since_tool:
                issues.append(f"Tool call at event {idx+1} not preceded by assistant speech")
            spoke_since_tool = False
    if not seen_assistant_speech:
        issues.append("No assistant speech found in session")
    return issues


def assert_tool_schema(events: List[Dict[str, Any]]) -> List[str]:
    issues = []
    known_ids: set = set()
    for idx, ev in enumerate(events):
        if ev.get("type") != "tool_call":
            continue
        problems = validate_tool_call(ev, known_ids)
        for p in problems:
            issues.append(f"Event {idx+1}: {p}")
    return issues


def assert_matches_golden(events: List[Dict[str, Any]], golden: Dict[str, Any]) -> List[str]:
    issues = []
    expected = golden.get("events", [])
    if len(events) < len(expected):
        issues.append(f"Session shorter than golden ({len(events)} < {len(expected)})")
        return issues
    for i, exp in enumerate(expected):
        ev = events[i]
        if ev.get("type") != exp.get("type"):
            issues.append(f"Event {i+1} type mismatch: {ev.get('type')} != {exp.get('type')}")
            continue
        if ev.get("type") == "speech":
            if ev.get("role") != exp.get("role"):
                issues.append(f"Event {i+1} role mismatch: {ev.get('role')} != {exp.get('role')}")
        elif ev.get("type") == "tool_call":
            if ev.get("name") != exp.get("name"):
                issues.append(f"Event {i+1} tool name mismatch: {ev.get('name')} != {exp.get('name')}")
    return issues


def validate_goldens(goldens: Dict[str, Dict[str, Any]]) -> List[str]:
    issues = []
    for name, data in goldens.items():
        if "events" not in data or not isinstance(data["events"], list):
            issues.append(f"Golden {name} missing events list")
        for idx, ev in enumerate(data.get("events", [])):
            if ev.get("type") not in {"speech", "tool_call"}:
                issues.append(f"Golden {name} event {idx+1} has invalid type {ev.get('type')}")
    return issues


def main():
    parser = argparse.ArgumentParser(description="Synapse prompt harness")
    parser.add_argument("--session", type=pathlib.Path, help="Path to JSONL session log", required=False)
    parser.add_argument("--golden", type=str, help="Name of golden dialogue to compare", required=False)
    parser.add_argument("--validate-goldens", action="store_true", help="Validate golden files only")
    args = parser.parse_args()

    goldens = list_goldens()

    if args.validate_goldens:
        problems = validate_goldens(goldens)
        if problems:
            for p in problems:
                print(f"FAIL: {p}")
            sys.exit(1)
        print("Goldens valid.")
        if not args.session:
            return

    if not args.session:
        print("No session log provided; nothing else to do.")
        return

    events = load_jsonl(args.session)
    issues = []
    issues += assert_no_code_speech(events)
    issues += assert_tool_schema(events)
    issues += assert_tool_speech_order(events)

    if args.golden:
        golden = goldens.get(args.golden)
        if not golden:
            print(f"Unknown golden '{args.golden}'. Available: {', '.join(goldens)}")
            sys.exit(1)
        issues += assert_matches_golden(events, golden)

    if issues:
        print("HARNESS FAIL")
        for issue in issues:
            print(f"- {issue}")
        sys.exit(1)

    print("HARNESS PASS")


if __name__ == "__main__":
    main()
