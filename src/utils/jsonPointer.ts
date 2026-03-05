/**
  Minimal JSON Pointer setter supporting array indices.
  Does not support escapes (~1, ~0) for brevity since patch paths are controlled.
*/
export function setByPointer(target: any, pointer: string, value: unknown) {
  if (!pointer.startsWith("/")) {
    throw new Error(`Invalid pointer: ${pointer}`);
  }
  const parts = pointer
    .split("/")
    .slice(1)
    .map((p) => (p === "" ? "" : p));
  let cursor: any = target;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    const isLast = i === parts.length - 1;
    const idx = Number.isInteger(Number(key)) ? Number(key) : key;
    if (isLast) {
      if (typeof idx === "number") {
        if (!Array.isArray(cursor)) cursor = [];
        (cursor as any[])[idx] = value;
      } else {
        cursor[idx] = value;
      }
    } else {
      const next = typeof idx === "number" ? [] : {};
      if (typeof idx === "number") {
        if (!Array.isArray(cursor[idx])) cursor[idx] = [];
      } else if (cursor[idx] === undefined) {
        cursor[idx] = next;
      }
      cursor = cursor[idx];
    }
  }
}
