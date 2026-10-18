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
// The first header has no gap above it and is the same size as the pinned bar, so it never moves before the bar takes over.
const rowSize = (rows: { type: string }[], i: number) => (rows[i].type === "header" ? (i === 0 ? PINNED_H : 56) : 68);
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

  // The pinned category bar is driven straight from scroll events (never through React state, which lags behind a fast scroll): the current header's label shows at the controls, and the next one pushes it up under them until it takes over.
  // Rows are fixed-size, so every header's offset in the list is known without measuring.
  const pinRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const pinLabel = useRef<HTMLSpanElement>(null);
  const pinCount = useRef<HTMLSpanElement>(null);
  const headers = useMemo(() => {
    let off = 0;
    const out: { off: number; label: string; count: number }[] = [];
    rows.forEach((r, i) => {
      if (r.type === "header") out.push({ off, label: cap(r.label), count: r.count });
      off += rowSize(rows, i);
    });
    return out;
  }, [rows]);
  const applyPin = () => {
    const el = pinnedRef.current;
    if (!el || !pinRef.current || !listRef.current) return;
    const bar = pinRef.current.getBoundingClientRect().bottom;
    const listTop = listRef.current.getBoundingClientRect().top;
    // Later header rows are 16px taller than the bar (the gap above their label), so they take over once the label reaches the bar's top.
    const at = (h: number) => listTop + headers[h].off + (h === 0 ? 0 : 16);
    let cur = -1;
    while (cur + 1 < headers.length && at(cur + 1) <= bar) cur++;
    el.style.visibility = cur < 0 ? "hidden" : "visible";
    if (cur < 0) return;
    if (el.dataset.i !== String(cur)) {
      el.dataset.i = String(cur);
      pinLabel.current!.textContent = headers[cur].label;
      pinCount.current!.textContent = String(headers[cur].count);
    }
    const push = cur + 1 < headers.length ? Math.max(-PINNED_H, Math.min(0, at(cur + 1) - bar - PINNED_H)) : 0;
    el.style.transform = `translateY(${push}px)`;
    el.toggleAttribute("data-pushed", push < 0);
  };
  useLayoutEffect(() => {
    delete pinnedRef.current?.dataset.i; // the rows changed: refill the label
    applyPin();
  });
  useEffect(() => {
    window.addEventListener("scroll", applyPin, { passive: true });
    return () => window.removeEventListener("scroll", applyPin);
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
      {headers.length > 0 && (
        <div ref={pinnedRef} className={`${s.header} ${s.pinned}`} style={{ visibility: "hidden" }} aria-hidden="true">
          <span ref={pinLabel} className={s.pinLabel} /> <span ref={pinCount} />
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
