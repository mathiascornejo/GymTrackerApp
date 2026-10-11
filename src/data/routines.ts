import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { newRoutine, type Block, type Day, type Routine } from "../routines/model";
import { supabase } from "./client";

type RoutineRow = { id: string; name: string; is_active: boolean; archived_at: string | null };
type DayRow = { id: string; routine_id: string; weekday: number; label: string; sort: number };
type BlockRow = {
  id: string;
  routine_id: string;
  routine_day_id: string | null;
  kind: Block["kind"];
  sort: number;
  sets: number;
  rest_s: number;
  transition_rest_s: number;
  weekdays: number[] | null;
  weekly_target: number | null;
};
type ItemRow = { id: string; block_id: string; exercise_ref: string; sort: number; rep_min: number; rep_max: number };

const KEY = ["routines"];
const ok = <T,>(r: { data: T | null; error: Error | null }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};
const bySort = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort;

async function fetchRoutines(): Promise<Routine[]> {
  const live = <T extends string>(table: T) => supabase.from(table).select("*").is("deleted_at", null);
  const [routines, days, blocks, items] = await Promise.all([
    live("routines").order("name").then((r) => ok<RoutineRow[]>(r)),
    live("routine_days").then((r) => ok<DayRow[]>(r)),
    live("routine_blocks").then((r) => ok<BlockRow[]>(r)),
    live("block_items").then((r) => ok<ItemRow[]>(r)),
  ]);

  const itemsOf = (blockId: string) => items.filter((i) => i.block_id === blockId).sort(bySort);
  const toBlock = (b: BlockRow): Block => ({
    id: b.id,
    kind: b.kind,
    sets: b.sets,
    restS: b.rest_s,
    transitionRestS: b.transition_rest_s,
    weekdays: b.weekdays,
    weeklyTarget: b.weekly_target,
    items: itemsOf(b.id).map((i) => ({ id: i.id, ref: i.exercise_ref, repMin: i.rep_min, repMax: i.rep_max })),
  });

  return routines.map((r) => {
    const mine = blocks.filter((b) => b.routine_id === r.id).sort(bySort);
    const fallback = newRoutine(r.name, r.is_active).days; // fills any weekday that has no row yet
    const dayList: Day[] = fallback.map((f) => {
      const row = days.find((d) => d.routine_id === r.id && d.weekday === f.weekday);
      return row
        ? { id: row.id, weekday: row.weekday, label: row.label, blocks: mine.filter((b) => b.routine_day_id === row.id).map(toBlock) }
        : f;
    });
    return {
      id: r.id,
      name: r.name,
      isActive: r.is_active,
      archivedAt: r.archived_at,
      days: dayList,
      bank: mine.filter((b) => b.routine_day_id === null).map(toBlock),
    };
  });
}

const flatBlocks = (r: Routine) => [...r.days.flatMap((d) => d.blocks.map((b) => ({ b, dayId: d.id }))), ...r.bank.map((b) => ({ b, dayId: null }))];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Rows of `r` that differ from `prev` (all of them when there is no prev). Keeps a typical edit to one or two requests. */
function changed<T extends { id: string }>(rows: T[], prevRows: T[]): T[] {
  const old = new Map(prevRows.map((x) => [x.id, x]));
  return rows.filter((x) => !same(x, old.get(x.id)));
}

const toRows = (r: Routine) => {
  const blocks = flatBlocks(r);
  return {
    routine: { id: r.id, name: r.name, is_active: r.isActive, archived_at: r.archivedAt },
    days: r.days.map((d, sort) => ({ id: d.id, routine_id: r.id, weekday: d.weekday, label: d.label, sort })),
    blocks: blocks.map(({ b, dayId }, sort) => ({
      id: b.id,
      routine_id: r.id,
      routine_day_id: dayId,
      kind: b.kind,
      sort,
      sets: b.sets,
      rest_s: b.restS,
      transition_rest_s: b.transitionRestS,
      weekdays: b.weekdays,
      weekly_target: b.weeklyTarget,
      deleted_at: null,
    })),
    items: blocks.flatMap(({ b }) =>
      b.items.map((it, sort) => ({ id: it.id, block_id: b.id, exercise_ref: it.ref, sort, rep_min: it.repMin, rep_max: it.repMax, deleted_at: null })),
    ),
  };
};

/** Upserts what changed, parents first (composite foreign keys), then soft-deletes rows that disappeared. */
async function saveRoutine(prev: Routine | null, next: Routine) {
  const check = (e: { error: Error | null }) => {
    if (e.error) throw e.error;
  };
  const n = toRows(next);
  const p = prev ? toRows(prev) : null;
  if (!p || !same(n.routine, p.routine)) check(await supabase.from("routines").upsert(n.routine, { onConflict: "id" }));
  const days = changed(n.days, p?.days ?? []);
  if (days.length) check(await supabase.from("routine_days").upsert(days, { onConflict: "id" }));
  const blocks = changed(n.blocks, p?.blocks ?? []);
  if (blocks.length) check(await supabase.from("routine_blocks").upsert(blocks, { onConflict: "id" }));
  const items = changed(n.items, p?.items ?? []);
  if (items.length) check(await supabase.from("block_items").upsert(items, { onConflict: "id" }));
  if (p) {
    const keepBlocks = new Set(n.blocks.map((b) => b.id));
    const keepItems = new Set(n.items.map((i) => i.id));
    const goneBlocks = p.blocks.filter((b) => !keepBlocks.has(b.id)).map((b) => b.id);
    const goneItems = p.items.filter((i) => !keepItems.has(i.id)).map((i) => i.id);
    const now = new Date().toISOString();
    if (goneItems.length) check(await supabase.from("block_items").update({ deleted_at: now }).in("id", goneItems));
    if (goneBlocks.length) check(await supabase.from("routine_blocks").update({ deleted_at: now }).in("id", goneBlocks));
  }
}

async function setActiveRows(id: string) {
  // Clear the old one first: a partial unique index allows only one active routine.
  const off = await supabase.from("routines").update({ is_active: false }).eq("is_active", true).neq("id", id);
  if (off.error) throw off.error;
  const on = await supabase.from("routines").update({ is_active: true }).eq("id", id);
  if (on.error) throw on.error;
}

async function softDelete(id: string) {
  const r = await supabase.from("routines").update({ deleted_at: new Date().toISOString(), is_active: false }).eq("id", id);
  if (r.error) throw r.error;
}

// Saves run strictly in order, so a slow earlier save can never land after a newer one.
let chain: Promise<unknown> = Promise.resolve();
let pending = 0;
// Closing the tab mid-save would drop the change; the browser's own prompt gives the save time to finish.
const guard = (e: BeforeUnloadEvent) => e.preventDefault();
const enqueue = (job: () => Promise<unknown>) => {
  if (pending++ === 0) window.addEventListener("beforeunload", guard);
  const p = chain.then(job, job);
  chain = p.catch(() => undefined).finally(() => {
    if (--pending === 0) window.removeEventListener("beforeunload", guard);
  });
  return p;
};

export const useRoutines = () => useQuery({ queryKey: KEY, queryFn: fetchRoutines });

/** Every action patches the cache synchronously (the UI never waits), then saves in the background. A failure refetches the truth. */
export function useRoutineActions() {
  const qc = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(0);
  const read = () => qc.getQueryData<Routine[]>(KEY) ?? [];
  const patch = (fn: (l: Routine[]) => Routine[]) => {
    void qc.cancelQueries({ queryKey: KEY }, { revert: false });
    qc.setQueryData<Routine[]>(KEY, fn(read()));
  };
  const run = (job: () => Promise<unknown>) => {
    setSaving((n) => n + 1);
    return enqueue(job)
      .then(
        () => setError(null),
        (e: Error) => {
          setError(e);
          void qc.invalidateQueries({ queryKey: KEY });
        },
      )
      .finally(() => setSaving((n) => n - 1));
  };

  const add = (r: Routine) => {
    patch((l) => [...l, r]);
    void run(() => saveRoutine(null, r));
    return r.id;
  };

  return {
    error,
    saving: saving > 0,
    clearError: () => setError(null),
    /** Applies `fn` to the latest cached routine, not the one a component last rendered: two quick taps both land. */
    update(id: string, fn: (r: Routine) => Routine) {
      const prev = read().find((r) => r.id === id);
      if (!prev) return;
      const next = fn(prev);
      patch((l) => l.map((r) => (r.id === id ? next : r)));
      void run(() => saveRoutine(prev, next));
    },
    /** The first routine becomes active so the session log has something to start from. */
    create(name: string) {
      return add(newRoutine(name, !read().some((r) => r.isActive && !r.archivedAt)));
    },
    addImported: add,
    setActive(id: string) {
      patch((l) => l.map((r) => ({ ...r, isActive: r.id === id })));
      void run(() => setActiveRows(id));
    },
    remove(id: string) {
      patch((l) => l.filter((r) => r.id !== id));
      void run(() => softDelete(id));
    },
  };
}
