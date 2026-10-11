/** Sets above this many reps are too unreliable to estimate a 1RM from. */
export const MAX_RANKING_REPS = 12;

/** Epley. One rep is the weight itself (the formula would add 3%). */
export const epley = (weightKg: number, reps: number) => (reps < 1 ? 0 : reps === 1 ? weightKg : weightKg * (1 + reps / 30));

export const rankable = (reps: number) => reps >= 1 && reps <= MAX_RANKING_REPS;
