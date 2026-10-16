import { epley, rankable } from "./e1rm";
import { derivedLift, IMPLAUSIBLE_RATIO, MUSCLES, RANKING_LIFTS, SECONDARY_CREDIT, thresholds, TIERS, type LoadModel, type Overrides, type RankingLift, type Table } from "./standards";

export type RankSet = {
  id: string;
  exercise_ref: string;
  weight_kg: number;
  reps: number;
  is_warmup: boolean;
  completed_at: string;
  confirmed?: boolean;
};
export type Bodyweight = { measured_on: string; weight_kg: number };

/** Bodyweight on the day of a set: the latest entry on or before it, else the earliest entry we have. */
export function bodyweightAt(iso: string, entries: Bodyweight[]): number | null {
  if (!entries.length) return null;
  const day = iso.slice(0, 10);
  const sorted = [...entries].sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  const before = sorted.filter((e) => e.measured_on <= day);
  return (before.length ? before[before.length - 1] : sorted[0]).weight_kg;
}

/** The load the lifter actually moved, by load model. Assisted can never go below zero. */
export const effectiveLoad = (model: LoadModel, weightKg: number, bodyweightKg: number) =>
  model === "bodyweight_plus" ? bodyweightKg + weightKg : model === "assisted" ? Math.max(0, bodyweightKg - weightKg) : weightKg;

/** Tier index plus fractional progress to the next tier. Wood (0) is any positive ratio; Olympian caps at 7. */
export function score(ratio: number, th: number[]): number {
  if (!(ratio > 0)) return 0;
  const bounds = [0, ...th];
  let i = 0;
  while (i + 1 < bounds.length && ratio >= bounds[i + 1]) i++;
  if (i >= bounds.length - 1) return bounds.length - 1;
  return i + (ratio - bounds[i]) / (bounds[i + 1] - bounds[i]);
}

export const tierOf = (s: number) => TIERS[Math.min(TIERS.length - 1, Math.floor(s + 1e-9))];
export const progressOf = (s: number) => (s >= TIERS.length - 1 ? 1 : s - Math.floor(s));

export type LiftRank = {
  lift: RankingLift;
  /** Best credited estimated 1RM, in kg (effective load). */
  e1rmKg: number;
  ratio: number;
  score: number;
  /** The set that produced it. */
  setId: string;
};

export type Flagged = { set: RankSet; lift: RankingLift; e1rmKg: number; ratio: number };

export type Ranks = {
  lifts: Map<string, LiftRank>;
  /** muscle -> best credited lift score (secondary muscles get SECONDARY_CREDIT of it); absent when there is no data. */
  muscles: Map<string, { score: number; lift: LiftRank }>;
  /** Median of the muscles that have data, or null when none do. */
  overall: number | null;
  flagged: Flagged[];
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Ranks from every logged working set. Sets with an implausible estimate (over IMPLAUSIBLE_RATIO x bodyweight)
 * are held back as `flagged` until confirmed; they never rank silently.
 */
export type MuscleInfo = { name?: string; primary: string[]; secondary: string[]; equipment: string | null };

/** The standard an exercise ranks against: its own, else one derived from its primary muscle. Stretches never rank. */
export function liftFor(ref: string, info: (ref: string) => MuscleInfo | undefined): RankingLift | null {
  const own = RANKING_LIFTS.find((l) => l.ref === ref);
  if (own) return own;
  const i = info(ref);
  return i?.primary[0] && !/stretch/i.test(i.name ?? "") ? derivedLift(ref, i.primary[0], i.equipment) : null;
}

/** How a set's load counts toward e1RM; the chart and the ranks must agree on it. */
export const loadModelFor = (ref: string, info: (ref: string) => MuscleInfo | undefined): LoadModel => liftFor(ref, info)?.load ?? "external";

export function computeRanks(
  sets: RankSet[],
  bodyweights: Bodyweight[],
  table: Table,
  overrides: Overrides = {},
  info: (ref: string) => MuscleInfo | undefined = () => undefined,
): Ranks {
  const liftOf = new Map<string, RankingLift | null>();
  const cachedLift = (ref: string) => {
    if (!liftOf.has(ref)) liftOf.set(ref, liftFor(ref, info));
    return liftOf.get(ref) ?? undefined;
  };
  const best = new Map<string, LiftRank>();
  const flagged: Flagged[] = [];

  for (const s of sets) {
    const lift = cachedLift(s.exercise_ref);
    if (!lift || s.is_warmup || !rankable(s.reps)) continue;
    const bw = bodyweightAt(s.completed_at, bodyweights);
    if (bw === null) continue; // no bodyweight yet: ranks wait for one
    const e1rmKg = epley(effectiveLoad(lift.load, s.weight_kg, bw), s.reps);
    const ratio = e1rmKg / bw;
    if (ratio > IMPLAUSIBLE_RATIO && !s.confirmed) {
      flagged.push({ set: s, lift, e1rmKg, ratio });
      continue;
    }
    const sc = score(ratio, thresholds(lift, table, overrides));
    const cur = best.get(lift.ref);
    if (!cur || sc > cur.score || (sc === cur.score && e1rmKg > cur.e1rmKg)) best.set(lift.ref, { lift, e1rmKg, ratio, score: sc, setId: s.id });
  }

  const muscles = new Map<string, { score: number; lift: LiftRank }>();
  for (const lr of best.values()) {
    const i = info(lr.lift.ref);
    const full = new Set([lr.lift.muscle, ...(i?.primary ?? [])]);
    const credit = new Map<string, number>([...full].map((m) => [m, lr.score]));
    for (const m of i?.secondary ?? []) if (!full.has(m)) credit.set(m, lr.score * SECONDARY_CREDIT);
    for (const [m, sc] of credit) {
      const cur = muscles.get(m);
      if (!cur || sc > cur.score) muscles.set(m, { score: sc, lift: lr });
    }
  }
  const scores = [...muscles.values()].map((m) => m.score);
  return { lifts: best, muscles, overall: scores.length ? median(scores) : null, flagged };
}

/** Muscles whose tier is higher in `after` than in `before`. */
export function tierChanges(before: Ranks, after: Ranks): { muscle: string; from: string; to: string }[] {
  return MUSCLES.flatMap((m) => {
    const a = after.muscles.get(m);
    if (!a) return [];
    const b = before.muscles.get(m);
    const from = b ? tierOf(b.score) : null;
    const to = tierOf(a.score);
    return TIERS.indexOf(to) > (from ? TIERS.indexOf(from as (typeof TIERS)[number]) : -1) && from !== null ? [{ muscle: m, from, to }] : [];
  });
}
