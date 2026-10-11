export type LoggedSet = { weightKg: number; reps: number };

export type Recommendation = {
  weightKg: number;
  reps: number;
  /** increase: all sets hit the top of the range. repeat: same weight, one more rep. below-min: a set fell short, no deload. */
  kind: "increase" | "repeat" | "below-min";
  lastWeightKg: number;
  lastReps: number[];
};

/** Bar and machine defaults, in kg. Per-exercise overrides live in profile.increments. */
export function defaultIncrementKg(equipment: string | null): number {
  switch (equipment) {
    case "dumbbell":
      return 2;
    case "machine":
    case "cable":
      return 5;
    default:
      return 2.5;
  }
}

const sameWeight = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/**
 * Suggests the next top set from the last session's working sets (in order). A suggestion, never an instruction.
 * No history means no recommendation.
 */
export function recommend(history: LoggedSet[], range: { min: number; max: number }, incrementKg: number): Recommendation | null {
  if (!history.length) return null;
  const lastWeightKg = history[history.length - 1].weightKg;
  const lastReps = history.filter((s) => sameWeight(s.weightKg, lastWeightKg)).map((s) => s.reps);
  const base = { lastWeightKg, lastReps };

  if (history.some((s) => s.reps < range.min)) return { ...base, kind: "below-min", weightKg: lastWeightKg, reps: range.min };
  if (lastReps.every((r) => r >= range.max)) return { ...base, kind: "increase", weightKg: lastWeightKg + incrementKg, reps: range.min };
  return { ...base, kind: "repeat", weightKg: lastWeightKg, reps: Math.min(range.max, Math.min(...lastReps) + 1) };
}
