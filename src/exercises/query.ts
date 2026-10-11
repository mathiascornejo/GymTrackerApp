import type { Exercise, Filters } from "./types";

/** Dataset labels are lower-case ("lower back"); the UI shows sentence case. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Row = { type: "header"; label: string; count: number } | { type: "item"; exercise: Exercise };

const FILTER_FIELDS = ["equipment", "level", "force", "mechanic", "category"] as const;

export function applyFilters(list: Exercise[], f: Filters): Exercise[] {
  return list.filter(
    (e) => (!f.muscle || e.primary.includes(f.muscle)) && FILTER_FIELDS.every((k) => !f[k] || e[k] === f[k]),
  );
}

/** Every query word must appear in the name, primary muscles or equipment. Name-prefix matches rank first. */
export function search(list: Exercise[], query: string): Exercise[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  const scored: [number, Exercise][] = [];
  for (const e of list) {
    const name = e.name.toLowerCase();
    const hay = `${name} ${e.primary.join(" ")} ${e.equipment ?? ""}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const score = name.startsWith(words[0]) ? 0 : name.split(/[\s-]+/).some((t) => t.startsWith(words[0])) ? 1 : 2;
    scored.push([score, e]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).map(([, e]) => e);
}

/** Grouped by primary muscle when browsing; a flat relevance list when searching. */
export function toRows(list: Exercise[], searching: boolean): Row[] {
  if (searching) return list.map((exercise) => ({ type: "item", exercise }));
  const groups = new Map<string, Exercise[]>();
  for (const e of [...list].sort((a, b) => a.name.localeCompare(b.name))) {
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
    level: uniq(list.map((e) => e.level)),
    force: uniq(list.map((e) => e.force)),
    mechanic: uniq(list.map((e) => e.mechanic)),
    category: uniq(list.map((e) => e.category)),
  };
}
