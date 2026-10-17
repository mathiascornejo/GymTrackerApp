export type DropIntent = "before" | "after" | "center";

/** Where on a card the pointer is: the middle 40% of its height means "make a superset", the rest means "reorder". */
export function dropIntent(pointerY: number, rect: { top: number; height: number }): DropIntent {
  const t = (pointerY - rect.top) / rect.height;
  return t < 0.3 ? "before" : t > 0.7 ? "after" : "center";
}

/** For an insertion line: is the pointer in the lower half of the card? */
export const insertAfter = (pointerY: number, rect: { top: number; height: number }) => pointerY > rect.top + rect.height / 2;
