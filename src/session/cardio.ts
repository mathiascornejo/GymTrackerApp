import type { Exercise } from "../exercises/types";

/** Cardio sets reuse the columns: `weight_kg` holds the machine level (never converted), `reps` holds seconds. */
export const isCardio = (e: Pick<Exercise, "category"> | undefined) => e?.category === "cardio";

/** "12:30" is 12 min 30 s; a bare number is minutes. Null when it is not a time. */
export function parseTime(text: string): number | null {
  const m = /^\s*(\d{1,3})(?::(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  const sec = m[2] === undefined ? 0 : Number(m[2]);
  return sec < 60 ? Number(m[1]) * 60 + sec : null;
}
