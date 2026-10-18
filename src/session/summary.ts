import { epley, rankable } from "../ranking/e1rm";

export type SetLike = { exercise_ref: string; weight_kg: number; reps: number; is_warmup: boolean };

export type Summary = { volumeKg: number; workingSets: number };

/** `isCardio` sets count as sets but add no volume: their columns hold level and seconds. */
export function summarize(sets: SetLike[], isCardio: (ref: string) => boolean = () => false): Summary {
  const working = sets.filter((s) => !s.is_warmup);
  return { volumeKg: working.reduce((n, s) => (isCardio(s.exercise_ref) ? n : n + s.weight_kg * s.reps), 0), workingSets: working.length };
}

const bestE1rm = (sets: SetLike[]) =>
  sets.filter((s) => !s.is_warmup && rankable(s.reps)).reduce((best, s) => Math.max(best, epley(s.weight_kg, s.reps)), 0);

export type PR = { ref: string; e1rmKg: number; previousKg: number };

/**
 * Exercises where this session's best estimated 1RM beats everything logged before.
 * An exercise with no earlier history is a first log, not a record.
 */
export function findPRs(current: SetLike[], prior: SetLike[]): PR[] {
  const refs = [...new Set(current.map((s) => s.exercise_ref))];
  return refs.flatMap((ref) => {
    const before = bestE1rm(prior.filter((s) => s.exercise_ref === ref));
    const now = bestE1rm(current.filter((s) => s.exercise_ref === ref));
    return before > 0 && now > before + 1e-9 ? [{ ref, e1rmKg: now, previousKg: before }] : [];
  });
}
