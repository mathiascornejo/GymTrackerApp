import { useQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

const PINNED_H = 40; // matches .pinned in Library.module.css
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
    // The first header has no gap above it and is the same size as the pinned bar, so it never moves before the bar takes over.
    estimateSize: (i) => (rows[i].type === "header" ? (i === 0 ? 40 : 56) : 68),
    overscan: 8,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  // The category label stays pinned under the controls; it swaps when the next header reaches it.
  const pinRef = useRef<HTMLDivElement>(null);
  const headerIdx = useMemo(() => rows.flatMap((r, i) => (r.type === "header" ? [i] : [])), [rows]);
  // Later header rows are 16px taller than the pinned bar (the gap above their label), so swap once the label reaches the bar's top: until then it hides under the bar.
  const pinBottom = (pinRef.current?.getBoundingClientRect().bottom ?? 0) + window.scrollY;
  const passed = headerIdx.filter((i) => (virtual.measurementsCache[i]?.start ?? Infinity) <= pinBottom - (i === 0 ? 0 : 16)).pop();
  const pinnedRow = passed === undefined ? undefined : rows[passed];
  // The next header's label pushes the pinned bar up (under the controls) until it takes its place. The offset is written straight to the DOM on every scroll event, not through React state, so it never lags a frame behind the page.
  const pinnedRef = useRef<HTMLDivElement>(null);
  const nextStart = useRef(Infinity);
  const nextHeader = passed === undefined ? undefined : headerIdx.find((i) => i > passed);
  nextStart.current = nextHeader === undefined ? Infinity : (virtual.measurementsCache[nextHeader]?.start ?? Infinity);
  const applyPush = () => {
    const el = pinnedRef.current;
    if (!el || !pinRef.current) return;
    const push = Math.max(-PINNED_H, Math.min(0, nextStart.current - window.scrollY + 16 - (pinRef.current.getBoundingClientRect().bottom + PINNED_H)));
    el.style.transform = `translateY(${push}px)`;
    el.toggleAttribute("data-pushed", push < 0);
  };
  useLayoutEffect(applyPush);
  useEffect(() => {
    window.addEventListener("scroll", applyPush, { passive: true });
    return () => window.removeEventListener("scroll", applyPush);
  });

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
      <div ref={pinRef} className={s.pin}>
      <div className={s.controls}>
        <label className={s.search}>
          <span className={s.visuallyHidden}>Search exercises</span>
          <input className={f.input} type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className={f.quiet} aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
          {activeFilters ? `Filters (${activeFilters})` : "Filters"}
        </button>
        <button className={f.quiet} onClick={() => setEditing("new")}>New exercise</button>
      </div>
      {pinnedRow?.type === "header" && (
        <div ref={pinnedRef} className={`${s.header} ${s.pinned}`} aria-hidden="true">
          {cap(pinnedRow.label)} <span>{pinnedRow.count}</span>
        </div>
      )}
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
        {virtual.getVirtualItems().map((v) => {
          const row = rows[v.index];
          const style = { height: v.size, transform: `translateY(${v.start - virtual.options.scrollMargin}px)` };
          if (row.type === "header")
            return (
              <h2 key={v.key} className={`${s.header} ${v.index === 0 ? s.headerFirst : ""}`} style={style}>
                {cap(row.label)} <span>{row.count}</span>
              </h2>
            );
          const e = row.exercise;
          const prev = rows[v.index - 1];
          const next = rows[v.index + 1];
          const pos = [prev?.type !== "item" && s.first, next?.type !== "item" && s.last].filter(Boolean).join(" ");
          return (
            <a key={v.key} href={href(e.ref)} className={`${s.row} ${pos}`} style={style}>
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
