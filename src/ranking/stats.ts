import { epley, rankable } from "./e1rm";
import { bodyweightAt, effectiveLoad, type Bodyweight, type RankSet } from "./rank";
import type { LoadModel } from "./standards";

/** Local midnight of the first day of the week containing `now`. weekStartsOn: 0 = Sunday. */
export function weekStart(now: Date, weekStartsOn: number): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - weekStartsOn + 7) % 7));
  return d;
}

/** Working sets per primary muscle since `from`. */
export function weeklyVolume(sets: RankSet[], primaryOf: (ref: string) => string[], from: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sets) {
    if (s.is_warmup || new Date(s.completed_at) < from) continue;
    for (const m of primaryOf(s.exercise_ref)) out[m] = (out[m] ?? 0) + 1;
  }
  return out;
}

/** Working sets per muscle per week worth aiming for. UNVERIFIED: a common hypertrophy guideline, not a standard. */
export const WEEKLY_SET_TARGET = { min: 10, max: 20 }; // UNVERIFIED

/** A weekly-sets bar on a fixed scale (1.5x the target top), so one muscle never fills the track just by leading. Percentages 0..100. */
export function volumeBar(sets: number, target = WEEKLY_SET_TARGET) {
  const axis = target.max * 1.5;
  const pct = (n: number) => Math.min(100, (n / axis) * 100);
  return { fill: pct(sets), bandFrom: pct(target.min), bandTo: pct(target.max) };
}

/** `weeks` columns ending with the current week, each with a session count per day (in week order). */
export function frequencyGrid(startedAt: string[], now: Date, weekStartsOn: number, weeks = 12) {
  const first = weekStart(now, weekStartsOn);
  first.setDate(first.getDate() - 7 * (weeks - 1));
  const grid = Array.from({ length: weeks }, (_, w) => {
    const d = new Date(first);
    d.setDate(d.getDate() + 7 * w);
    return { weekStart: d, days: Array<number>(7).fill(0) };
  });
  for (const iso of startedAt) {
    const t = new Date(iso);
    const w = Math.floor((weekStart(t, weekStartsOn).getTime() - first.getTime()) / (7 * 86_400_000) + 0.5);
    if (w < 0 || w >= weeks) continue;
    grid[w].days[(t.getDay() - weekStartsOn + 7) % 7]++;
  }
  return grid;
}

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Best estimated 1RM (effective load) per day for one lift, oldest first. */
export function e1rmSeries(sets: RankSet[], ref: string, load: LoadModel, bodyweights: Bodyweight[], since: Date | null) {
  const byDay = new Map<string, { t: number; e1rmKg: number }>();
  for (const s of sets) {
    if (s.exercise_ref !== ref || s.is_warmup || !rankable(s.reps)) continue;
    const t = new Date(s.completed_at);
    if (since && t < since) continue;
    const bw = bodyweightAt(s.completed_at, bodyweights);
    if (bw === null && load !== "external") continue;
    const e = epley(effectiveLoad(load, s.weight_kg, bw ?? 0), s.reps);
    const key = localDay(s.completed_at);
    const cur = byDay.get(key);
    if (!cur || e > cur.e1rmKg) byDay.set(key, { t: t.getTime(), e1rmKg: e });
  }
  return [...byDay.values()].sort((a, b) => a.t - b.t);
}

export type PrEvent = { ref: string; at: string; e1rmKg: number; previousKg: number };

/** Every time a lift's estimated 1RM beat its earlier best, oldest first. A lift's first log is not a record. */
export function prEvents(sets: RankSet[]): PrEvent[] {
  const best = new Map<string, number>();
  const out: PrEvent[] = [];
  const ordered = [...sets].filter((s) => !s.is_warmup && rankable(s.reps)).sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  for (const s of ordered) {
    const e = epley(s.weight_kg, s.reps);
    const prev = best.get(s.exercise_ref);
    if (prev !== undefined && e > prev + 1e-9) out.push({ ref: s.exercise_ref, at: s.completed_at, e1rmKg: e, previousKg: prev });
    if (prev === undefined || e > prev) best.set(s.exercise_ref, e);
  }
  return out;
}

/** Trailing moving average over `days` calendar days ending at each point. Points are sorted by `t` (ms). */
export function movingAverage(points: { t: number; v: number }[], days = 7): { t: number; v: number }[] {
  const win = days * 86_400_000;
  return points.map((p) => {
    const inWindow = points.filter((q) => q.t <= p.t && q.t > p.t - win);
    return { t: p.t, v: inWindow.reduce((a, q) => a + q.v, 0) / inWindow.length };
  });
}

/** Mean of the points on the last `days` calendar days including today (local time); null when there are none. */
export function averageOver(points: { t: number; v: number }[], days: number, now = new Date()): number | null {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const inWindow = points.filter((p) => p.t >= from && p.t < to);
  return inWindow.length ? inWindow.reduce((a, p) => a + p.v, 0) / inWindow.length : null;
}
