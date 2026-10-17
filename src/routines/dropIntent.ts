export type DropIntent = "before" | "after" | "center";

/** Where on a card the pointer is: the middle 40% of its height means "make a superset", the rest means "reorder". */
export function dropIntent(pointerY: number, rect: { top: number; height: number }): DropIntent {
  const t = (pointerY - rect.top) / rect.height;
  return t < 0.3 ? "before" : t > 0.7 ? "after" : "center";
}
