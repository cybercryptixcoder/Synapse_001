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

  const isIndex = (p: string) => Number.isInteger(Number(p));

  for (let i = 0; i < parts.length; i++) {
    const rawKey = parts[i];
    const keyIsIndex = isIndex(rawKey);
    const key = keyIsIndex ? Number(rawKey) : rawKey;
    const isLast = i === parts.length - 1;

    if (isLast) {
      if (keyIsIndex && Array.isArray(cursor)) {
        cursor[key] = value;
      } else {
        cursor[key as any] = value;
      }
      return;
    }

    const nextRaw = parts[i + 1];
    const nextShouldBeArray = isIndex(nextRaw);

    if (keyIsIndex && Array.isArray(cursor)) {
      if (
        cursor[key] === undefined ||
        cursor[key] === null ||
        typeof cursor[key] !== "object" ||
        (nextShouldBeArray && !Array.isArray(cursor[key])) ||
        (!nextShouldBeArray && Array.isArray(cursor[key]))
      ) {
        cursor[key] = nextShouldBeArray ? [] : {};
      }
      cursor = cursor[key];
      continue;
    }

    if (
      cursor[key as any] === undefined ||
      cursor[key as any] === null ||
      typeof cursor[key as any] !== "object" ||
      (nextShouldBeArray && !Array.isArray(cursor[key as any])) ||
      (!nextShouldBeArray && Array.isArray(cursor[key as any]))
    ) {
      cursor[key as any] = nextShouldBeArray ? [] : {};
    }
    cursor = cursor[key as any];
  }
}
