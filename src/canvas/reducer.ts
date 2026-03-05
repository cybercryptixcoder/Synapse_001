import { CanvasState, Patch } from "./types";
import { setByPointer } from "../utils/jsonPointer";

export const initialCanvasState: CanvasState = {
  components: {},
  order: [],
  meta: { lastUpdated: Date.now() },
};

export function applyPatches(state: CanvasState, patches: Patch[]): CanvasState {
  let next = { ...state, components: { ...state.components }, order: [...state.order] };
  for (const patch of patches) {
    if (patch.op === "add") {
      const { component, after } = patch;
      if (next.components[component.id]) {
        // skip duplicate add
        continue;
      }
      next.components[component.id] = component;
      if (after && next.order.includes(after)) {
        const idx = next.order.indexOf(after);
        next.order.splice(idx + 1, 0, component.id);
      } else {
        next.order.push(component.id);
      }
    } else if (patch.op === "update") {
      const { id, path, value } = patch;
      const comp = next.components[id];
      if (!comp) continue;
      const clone = structuredClone(comp);
      try {
        setByPointer(clone as any, path, value);
        next.components[id] = clone;
      } catch (e) {
        console.warn("Failed to apply patch path", path, e);
      }
    } else if (patch.op === "remove") {
      const { id } = patch;
      if (next.components[id]) {
        delete next.components[id];
        next.order = next.order.filter((cid) => cid !== id);
      }
    }
  }
  next.meta = { ...(next.meta || {}), lastUpdated: Date.now() };
  return next;
}
