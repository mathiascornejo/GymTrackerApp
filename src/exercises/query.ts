import { RANKING_LIFTS } from "../ranking/standards";
import type { Exercise, Filters } from "./types";

const STAPLES = new Set(RANKING_LIFTS.map((l) => l.ref));
// shortcut: the dataset has no popularity data, so "common" is a heuristic (staple lifts, plain equipment, short names); upgrade if real usage data appears.
const EQUIPMENT_RANK: Record<string, number> = { barbell: 0, dumbbell: 0, "body weight": 1, "body only": 1, cable: 1, "leverage machine": 1, "ez barbell": 1, kettlebell: 2, "smith machine": 2 };

/** Lower is more common: ranked lifts first, then barbell/dumbbell/bodyweight/cable, then shorter (plainer) names. */
export const commonness = (e: Exercise) =>
  (STAPLES.has(e.ref) ? 0 : 100) + (EQUIPMENT_RANK[e.equipment ?? ""] ?? 3) * 10 + e.name.split(/\s+/).length;

/** Dataset labels are lower-case ("lower back"); the UI shows sentence case. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Row = { type: "header"; label: string; count: number } | { type: "item"; exercise: Exercise };

const FILTER_FIELDS = ["equipment", "category"] as const;

export function applyFilters(list: Exercise[], f: Filters): Exercise[] {
  return list.filter(
    (e) => (!f.muscle || e.primary.includes(f.muscle)) && FILTER_FIELDS.every((k) => !f[k] || e[k] === f[k]),
  );
}

/** Every query word must appear in the name, primary muscles or equipment. Name-prefix matches rank first. */
export function search(list: Exercise[], query: string): Exercise[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const byCommon = (a: Exercise, b: Exercise) => commonness(a) - commonness(b) || a.name.localeCompare(b.name);
  if (!words.length) return [...list].sort(byCommon);
  const scored: [number, Exercise][] = [];
  for (const e of list) {
    const name = e.name.toLowerCase();
    const hay = `${name} ${e.primary.join(" ")} ${e.equipment ?? ""}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const score = name.startsWith(words[0]) ? 0 : name.split(/[\s-]+/).some((t) => t.startsWith(words[0])) ? 1 : 2;
    scored.push([score, e]);
  }
  return scored.sort((a, b) => a[0] - b[0] || byCommon(a[1], b[1])).map(([, e]) => e);
}

/** Grouped by primary muscle when browsing; a flat relevance list when searching. */
export function toRows(list: Exercise[], searching: boolean): Row[] {
  if (searching) return list.map((exercise) => ({ type: "item", exercise }));
  const groups = new Map<string, Exercise[]>();
  for (const e of [...list].sort((a, b) => commonness(a) - commonness(b) || a.name.localeCompare(b.name))) {
    const key = e.primary[0] ?? "other";
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([label, items]): Row[] => [
      { type: "header", label, count: items.length },
      ...items.map((exercise): Row => ({ type: "item", exercise })),
    ]);
}

export function facets(list: Exercise[]) {
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))].sort();
  return {
    muscle: uniq(list.flatMap((e) => [...e.primary, ...e.secondary])),
    equipment: uniq(list.map((e) => e.equipment)),
    category: uniq(list.map((e) => e.category)),
  };
}
