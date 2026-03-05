import { Patch } from "../canvas/types";

export const mockIntroPatches: Patch[] = [
  {
    op: "add",
    component: {
      kind: "stepList",
      id: "merge-steps",
      title: "Merge Sort",
      steps: [{ id: "step-1", text: "Split array into halves" }],
    },
  },
  {
    op: "add",
    component: {
      kind: "codeViewer",
      id: "merge-code",
      language: "javascript",
      code: `function mergeSort(arr) {\n  if (arr.length <= 1) return arr;\n  const mid = Math.floor(arr.length / 2);\n  const left = mergeSort(arr.slice(0, mid));\n  const right = mergeSort(arr.slice(mid));\n  return merge(left, right);\n}\n\nfunction merge(left, right) {\n  const res = [];\n  while (left.length && right.length) {\n    if (left[0] < right[0]) res.push(left.shift());\n    else res.push(right.shift());\n  }\n  return [...res, ...left, ...right];\n}`,
    },
  },
];

export const mockPredictionPatches: Patch[] = [
  {
    op: "update",
    id: "merge-steps",
    path: "/steps/1",
    value: { id: "step-2", text: "Merge sorted halves" },
  },
  {
    op: "add",
    component: {
      kind: "outputTerminal",
      id: "output-terminal-1",
      entries: [
        { kind: "stdout", text: "run A: [1,2,3,4]" },
        { kind: "stdout", text: "run B (start=1): [2,1,3,4]" },
      ],
    },
  },
  {
    op: "add",
    component: { kind: "textNote", id: "note-1", text: "Off-by-one changes the merge start position." },
  },
];
