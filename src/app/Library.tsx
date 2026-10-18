import { useQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import { useCustomExercises } from "../data/customExercises";
import type { Profile } from "../data/profile";
import { loadDataset } from "../exercises/dataset";
import { applyFilters, cap, facets, search, toRows } from "../exercises/query";
import type { Exercise, Filters } from "../exercises/types";
import { CustomExerciseForm } from "./CustomExerciseForm";
import { ExerciseDetail, Sheet } from "./ExerciseSheet";
import { useRouteArg } from "./routes";
import f from "./Form.module.css";
import s from "./Library.module.css";

const FILTERS = ["muscle", "equipment", "category"] as const;
const LABELS: Record<(typeof FILTERS)[number], string> = {
  muscle: "Muscle",
  equipment: "Equipment",
  category: "Body area",
};

const HEADER_H = 34; // matches .header in Library.module.css
const FADE_H = 10; // clear space under the title where rows fade out beneath a pinned title
const GAP_H = 16; // space above every category title except the first
const ITEM_H = 68;
const rowSize = (rows: { type: string }[], i: number) => (rows[i].type === "header" ? HEADER_H + FADE_H + (i === 0 ? 0 : GAP_H) : ITEM_H);
const href = (ref: string) => `#/library/${encodeURIComponent(ref)}`;

export function Library({ profile }: { profile: Profile }) {
  const dataset = useQuery({ queryKey: ["dataset"], queryFn: loadDataset, staleTime: Infinity });
  const custom = useCustomExercises();
  const arg = useRouteArg();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<Exercise | "new" | null>(null);

  const all = useMemo(() => [...(dataset.data ?? []), ...(custom.data ?? [])], [dataset.data, custom.data]);
  const options = useMemo(() => facets(all), [all]);
  const rows = useMemo(() => {
    const found = search(applyFilters(all, filters), query);
    return toRows(found, query.trim() !== "");
  }, [all, filters, query]);
  const resultCount = rows.filter((r) => r.type === "item").length;
  const activeFilters = FILTERS.filter((k) => filters[k]).length;

  const listRef = useRef<HTMLDivElement>(null);
  const virtual = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => rowSize(rows, i),
    overscan: 8,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  // Each category is a block holding its title and rows. The title is `position: sticky`, so the browser pins it and
  // pushes it away at the end of its block on the compositor, in step with the scroll (no scroll handler to lag behind).
  // The virtualizer still decides which rows exist; a block is drawn while any of its rows is in range.
  const layout = useMemo(() => {
    const groups: { start: number; size: number; label?: string; count: number }[] = [];
    const groupOf: number[] = [];
    const offs: number[] = [];
    let off = 0;
    rows.forEach((r, i) => {
      if (r.type === "header" || groups.length === 0) groups.push({ start: off, size: 0, label: r.type === "header" ? cap(r.label) : undefined, count: r.type === "header" ? r.count : 0 });
      const h = rowSize(rows, i);
      groups[groups.length - 1].size += h;
      groupOf[i] = groups.length - 1;
      offs[i] = off;
      off += h;
    });
    return { groups, groupOf, offs };
  }, [rows]);
  const items = virtual.getVirtualItems();

  const selected = arg ? all.find((e) => e.ref === arg) : undefined;
  const close = () => {
    location.hash = "#/library";
  };

  if (dataset.error)
    return (
      <p className={f.error} role="alert">
        Could not load the exercise list: {dataset.error.message}
      </p>
    );

  return (
    <div>
      <div className={s.pin}>
      <div className={s.controls}>
        <label className={s.search}>
          <span className={s.visuallyHidden}>Search exercises</span>
          <input className={f.input} type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className={`${f.quiet} ${s.filtersBtn}`} aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
          {activeFilters ? `Filters (${activeFilters})` : "Filters"}
        </button>
        <button className={`${f.button} ${s.newExercise}`} onClick={() => setEditing("new")}>New exercise</button>
      </div>
      </div>

      {showFilters && (
        <div className={s.filters}>
          {FILTERS.map((k) => (
            <label key={k}>
              {LABELS[k]}
              <select className={f.input} value={filters[k] ?? ""} onChange={(e) => setFilters({ ...filters, [k]: e.target.value || undefined })}>
                <option value="">Any</option>
                {options[k].map((o) => (
                  <option key={o} value={o}>{cap(o)}</option>
                ))}
              </select>
            </label>
          ))}
          {activeFilters > 0 && <button className={f.quiet} onClick={() => setFilters({})}>Clear filters</button>}
        </div>
      )}

      {custom.error && <p className={f.note}>Your custom exercises could not be loaded: {custom.error.message}</p>}
      <p className={s.visuallyHidden} aria-live="polite">
        {dataset.isPending ? "Loading exercises" : `${resultCount} ${resultCount === 1 ? "exercise" : "exercises"}`}
      </p>

      {!dataset.isPending && resultCount === 0 && <p className={f.lead}>No exercises match. Try a different word or clear the filters.</p>}

      <div ref={listRef} className={s.list} style={{ height: virtual.getTotalSize() }}>
        {[...new Set(items.map((v) => layout.groupOf[v.index]))].map((gi) => {
          const g = layout.groups[gi];
          const inGroup = items.filter((v) => layout.groupOf[v.index] === gi && rows[v.index].type === "item");
          return (
            <div key={g.label ?? "all"} className={s.group} style={{ top: g.start, height: g.size, paddingTop: g.label !== undefined && gi > 0 ? GAP_H : 0 }}>
              {g.label !== undefined && (
                <h2 className={s.header}>
                  {g.label} <span>{g.count}</span>
                </h2>
              )}
              {inGroup.map((v) => {
                const row = rows[v.index];
                if (row.type !== "item") return null;
                const e = row.exercise;
                const first = rows[v.index - 1]?.type !== "item";
                const last = rows[v.index + 1]?.type !== "item";
                const pos = [first && s.first, last && s.last].filter(Boolean).join(" ");
                return (
                  <a key={v.key} href={href(e.ref)} className={`${s.row} ${pos}`} style={{ height: ITEM_H, top: layout.offs[v.index] - g.start }}>
                    {e.images[0] ? <img className={s.thumb} src={e.images[0]} alt="" loading="lazy" width={40} height={40} /> : <span className={s.thumb} />}
                    <span className={s.rowText}>
                      <span className={s.name}>{e.name}</span>
                      <span className={s.sub}>
                        {[e.primary[0] && cap(e.primary[0]), e.equipment, e.custom && "Custom"].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          );
        })}
      </div>

      <Sheet open={Boolean(selected)} onClose={() => arg && close()} label={selected?.name ?? "Exercise"}>
        {selected && <ExerciseDetail exercise={selected} profile={profile} onClose={close} onEdit={() => setEditing(selected)} />}
      </Sheet>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} label="Custom exercise">
        {editing !== null && (
          <>
            <h2 className={s.sheetTitle}>{editing === "new" ? "New exercise" : "Edit exercise"}</h2>
            <CustomExerciseForm existing={editing === "new" ? null : editing} options={options} onDone={() => setEditing(null)} />
          </>
        )}
      </Sheet>
    </div>
  );
}
