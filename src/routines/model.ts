// Pure routine operations. The UI and the repository both work on this nested document; saves diff it into rows.

export type BlockKind = "single" | "superset" | "circuit";
export type Item = { id: string; ref: string; repMin: number; repMax: number };
export type Block = {
  id: string;
  kind: BlockKind;
  sets: number;
  restS: number;
  transitionRestS: number;
  items: Item[];
  /** Bank blocks only: the weekdays (0 = Sunday) a block appears on. */
  weekdays: number[] | null;
  /** Bank blocks only: optional block with a "n of target this week" counter. */
  weeklyTarget: number | null;
};
export type Day = { id: string; weekday: number; label: string; blocks: Block[] };
export type Routine = {
  id: string;
  name: string;
  isActive: boolean;
  archivedAt: string | null;
  days: Day[];
  bank: Block[];
};
export type Target = { day: number } | "bank";

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const uuid = () => crypto.randomUUID();
const kindOf = (n: number): BlockKind => (n <= 1 ? "single" : n === 2 ? "superset" : "circuit");

export const newRoutine = (name: string, isActive: boolean): Routine => ({
  id: uuid(),
  name,
  isActive,
  archivedAt: null,
  days: ALL_WEEKDAYS.map((weekday) => ({ id: uuid(), weekday, label: "", blocks: [] })),
  bank: [],
});

export const newItem = (ref: string): Item => ({ id: uuid(), ref, repMin: 8, repMax: 12 });

export const newBlock = (ref: string, restS: number): Block => ({
  id: uuid(),
  kind: "single",
  sets: 3,
  restS,
  transitionRestS: 0,
  items: [newItem(ref)],
  weekdays: null,
  weeklyTarget: null,
});

export const containerBlocks = (r: Routine, t: Target): Block[] => (t === "bank" ? r.bank : r.days.find((d) => d.weekday === t.day)!.blocks);

function withContainer(r: Routine, t: Target, blocks: Block[]): Routine {
  if (t === "bank") return { ...r, bank: blocks };
  return { ...r, days: r.days.map((d) => (d.weekday === t.day ? { ...d, blocks } : d)) };
}

export function locate(r: Routine, blockId: string): { target: Target; index: number; block: Block } | null {
  const targets: Target[] = [...ALL_WEEKDAYS.map((day) => ({ day })), "bank"];
  for (const target of targets) {
    const index = containerBlocks(r, target).findIndex((b) => b.id === blockId);
    if (index >= 0) return { target, index, block: containerBlocks(r, target)[index] };
  }
  return null;
}

/** Bank blocks need a schedule, so a block entering the bank defaults to daily; leaving the bank clears it. */
const forTarget = (b: Block, t: Target): Block =>
  t === "bank" ? { ...b, weekdays: b.weekdays ?? (b.weeklyTarget ? null : ALL_WEEKDAYS) } : { ...b, weekdays: null, weeklyTarget: null };

export function addBlock(r: Routine, t: Target, block: Block, index?: number): Routine {
  const list = [...containerBlocks(r, t)];
  list.splice(index ?? list.length, 0, forTarget(block, t));
  return withContainer(r, t, list);
}

export function removeBlock(r: Routine, id: string): Routine {
  const at = locate(r, id);
  return at ? withContainer(r, at.target, containerBlocks(r, at.target).filter((b) => b.id !== id)) : r;
}

export function moveBlock(r: Routine, id: string, t: Target, index?: number): Routine {
  const at = locate(r, id);
  if (!at) return r;
  return addBlock(removeBlock(r, id), t, at.block, index);
}

export function updateBlock(r: Routine, id: string, patch: Partial<Omit<Block, "id" | "items" | "kind">>): Routine {
  const at = locate(r, id);
  if (!at) return r;
  const list = containerBlocks(r, at.target).map((b) => (b.id === id ? { ...b, ...patch } : b));
  return withContainer(r, at.target, list);
}

function mapBlock(r: Routine, id: string, fn: (b: Block) => Block | null): Routine {
  const at = locate(r, id);
  if (!at) return r;
  const list = containerBlocks(r, at.target).flatMap((b) => (b.id === id ? [fn(b)] : [b])).filter((b): b is Block => b !== null);
  return withContainer(r, at.target, list);
}

export function updateItem(r: Routine, blockId: string, itemId: string, patch: { repMin?: number; repMax?: number }): Routine {
  return mapBlock(r, blockId, (b) => ({
    ...b,
    items: b.items.map((it) => {
      if (it.id !== itemId) return it;
      // The edited bound pushes the other one so min never exceeds max.
      let { repMin, repMax } = it;
      if (patch.repMin !== undefined) {
        repMin = Math.max(1, patch.repMin);
        repMax = Math.max(repMax, repMin);
      }
      if (patch.repMax !== undefined) {
        repMax = Math.max(1, patch.repMax);
        repMin = Math.min(repMin, repMax);
      }
      return { ...it, repMin, repMax };
    }),
  }));
}

export function removeItem(r: Routine, blockId: string, itemId: string): Routine {
  return mapBlock(r, blockId, (b) => {
    const items = b.items.filter((i) => i.id !== itemId);
    return items.length ? { ...b, items, kind: kindOf(items.length) } : null;
  });
}

/** Pulls one exercise out of a superset into its own block (same sets and rest) at a position in any day or the bank. */
export function extractItem(r: Routine, blockId: string, itemId: string, t: Target, index?: number): Routine {
  const at = locate(r, blockId);
  const item = at?.block.items.find((i) => i.id === itemId);
  if (!at || !item || at.block.items.length < 2) return r;
  const single: Block = { ...at.block, id: uuid(), kind: "single", transitionRestS: 0, items: [item] };
  // Removing the item can shift the index when the drop is in the same container, so insert by the block it lands before.
  const before = index !== undefined ? containerBlocks(r, t)[index]?.id : undefined;
  const out = removeItem(r, blockId, itemId);
  const list = containerBlocks(out, t);
  const i = before ? list.findIndex((b) => b.id === before) : -1;
  return addBlock(out, t, single, i >= 0 ? i : t === at.target && index === undefined ? at.index + 1 : undefined);
}

export function addItem(r: Routine, blockId: string, ref: string): Routine {
  return mapBlock(r, blockId, (b) => {
    const items = [...b.items, newItem(ref)];
    return { ...b, items, kind: kindOf(items.length) };
  });
}

/** Merges blocks into the first one found on the board. Sets and rest come from that first block. */
export function link(r: Routine, ids: string[]): Routine {
  const found = ids.map((id) => locate(r, id)).filter((x): x is NonNullable<ReturnType<typeof locate>> => x !== null);
  if (found.length < 2) return r;
  const order: Target[] = [...ALL_WEEKDAYS.map((day) => ({ day })), "bank"];
  const rank = (t: Target) => order.findIndex((o) => JSON.stringify(o) === JSON.stringify(t));
  const [first, ...rest] = [...found].sort((a, b) => rank(a.target) - rank(b.target) || a.index - b.index);
  const items = [...first.block.items, ...rest.flatMap((x) => x.block.items)];
  let out = rest.reduce((acc, x) => removeBlock(acc, x.block.id), r);
  out = mapBlock(out, first.block.id, (b) => ({ ...b, items, kind: kindOf(items.length) }));
  return out;
}

export function unlink(r: Routine, blockId: string): Routine {
  const at = locate(r, blockId);
  if (!at || at.block.items.length < 2) return r;
  const singles = at.block.items.map((item) => ({ ...at.block, id: uuid(), kind: "single" as const, items: [item] }));
  const list = [...containerBlocks(r, at.target)];
  list.splice(at.index, 1, ...singles);
  return withContainer(r, at.target, list);
}

export function duplicate(r: Routine, name: string): Routine {
  const copy = newRoutine(name, false);
  const fresh = (b: Block): Block => ({ ...b, id: uuid(), items: b.items.map((i) => ({ ...i, id: uuid() })) });
  return { ...copy, days: copy.days.map((d, i) => ({ ...d, label: r.days[i].label, blocks: r.days[i].blocks.map(fresh) })), bank: r.bank.map(fresh) };
}

/** Sets per week by primary muscle. A bank block counts once per scheduled weekday, or per weekly target. */
export function weeklySets(r: Routine, primaryOf: (ref: string) => string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (b: Block, times: number) => {
    for (const item of b.items) for (const m of primaryOf(item.ref)) out[m] = (out[m] ?? 0) + b.sets * times;
  };
  r.days.forEach((d) => d.blocks.forEach((b) => add(b, 1)));
  r.bank.forEach((b) => add(b, b.weekdays?.length ?? b.weeklyTarget ?? 0));
  return out;
}

/** Headline numbers for the overview card. Bank blocks count once per scheduled day, or the weekly target. */
export function routineStats(r: Routine) {
  const times = (b: Block) => b.weekdays?.length ?? b.weeklyTarget ?? 0;
  const blocks = [...r.days.flatMap((d) => d.blocks.map((b) => [b, 1] as const)), ...r.bank.map((b) => [b, times(b)] as const)];
  return {
    trainingDays: r.days.filter((d) => d.blocks.length > 0 || r.bank.some((b) => b.weekdays?.includes(d.weekday))).length,
    exercises: new Set(blocks.flatMap(([b]) => b.items.map((i) => i.ref))).size,
    weeklySets: blocks.reduce((n, [b, t]) => n + b.sets * t, 0),
  };
}

export type PairNote = "push-pull" | "same-muscle" | null;

export function pairNote(b: Block, info: (ref: string) => { force: string | null; primary: string[] } | undefined): PairNote {
  if (b.items.length !== 2) return null;
  const [x, y] = b.items.map((i) => info(i.ref));
  if (!x || !y) return null;
  const forces = [x.force, y.force].sort().join();
  if (forces === "pull,push") return "push-pull";
  return x.primary[0] && x.primary[0] === y.primary[0] ? "same-muscle" : null;
}

// ---- JSON import and export ----

type ExportBlock = { sets: number; restS: number; transitionRestS: number; weekdays: number[] | null; weeklyTarget: number | null; items: { ref: string; repMin: number; repMax: number }[] };
export type RoutineExport = {
  format: "tempered-routine";
  version: 1;
  name: string;
  days: { weekday: number; label: string; blocks: ExportBlock[] }[];
  bank: ExportBlock[];
};

const toExportBlock = (b: Block): ExportBlock => ({
  sets: b.sets,
  restS: b.restS,
  transitionRestS: b.transitionRestS,
  weekdays: b.weekdays,
  weeklyTarget: b.weeklyTarget,
  items: b.items.map(({ ref, repMin, repMax }) => ({ ref, repMin, repMax })),
});

export const exportRoutine = (r: Routine): RoutineExport => ({
  format: "tempered-routine",
  version: 1,
  name: r.name,
  days: r.days.filter((d) => d.blocks.length || d.label).map((d) => ({ weekday: d.weekday, label: d.label, blocks: d.blocks.map(toExportBlock) })),
  bank: r.bank.map(toExportBlock),
});

const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const REF = /^(ds:.+|custom:[0-9a-fA-F-]{36})$/;

/** Validates untrusted JSON. Returns every problem found, or a fresh routine with new ids. */
export function importRoutine(input: unknown, refExists: (ref: string) => boolean): { routine: Routine } | { errors: string[] } {
  const errors: string[] = [];
  const o = input as Partial<RoutineExport> | null;
  if (!o || typeof o !== "object" || o.format !== "tempered-routine" || o.version !== 1) return { errors: ["This file is not a Tempered routine export (format 'tempered-routine', version 1)."] };
  if (typeof o.name !== "string" || !o.name.trim()) errors.push("name: a routine name is required.");
  if (!Array.isArray(o.days)) errors.push("days: must be a list.");
  if (!Array.isArray(o.bank)) errors.push("bank: must be a list.");
  if (errors.length) return { errors };

  const block = (raw: ExportBlock, where: string, bank: boolean): Block | null => {
    let ok = true;
    const bad = (m: string) => {
      errors.push(`${where}: ${m}`);
      ok = false;
    };
    if (!isInt(raw?.sets, 1, 30)) bad("sets must be a whole number from 1 to 30.");
    if (!isInt(raw?.restS, 0, 3600)) bad("restS must be seconds from 0 to 3600.");
    if (!isInt(raw?.transitionRestS ?? 0, 0, 3600)) bad("transitionRestS must be seconds from 0 to 3600.");
    if (!Array.isArray(raw?.items) || !raw.items.length) {
      bad("a block needs at least one item.");
      return null;
    }
    const items: Item[] = [];
    raw.items.forEach((it, i) => {
      if (typeof it?.ref !== "string" || !REF.test(it.ref)) bad(`item ${i + 1}: ref must look like ds:<id> or custom:<uuid>.`);
      else if (!refExists(it.ref)) bad(`item ${i + 1}: unknown exercise ${it.ref}.`);
      if (!isInt(it?.repMin, 1, 100) || !isInt(it?.repMax, 1, 100) || it.repMax < it.repMin) bad(`item ${i + 1}: repMin and repMax must be whole numbers with repMin <= repMax.`);
      items.push({ id: uuid(), ref: it?.ref, repMin: it?.repMin, repMax: it?.repMax });
    });
    const weekdays = raw.weekdays ?? null;
    if (weekdays !== null && (!Array.isArray(weekdays) || !weekdays.every((d) => isInt(d, 0, 6)))) bad("weekdays must be a list of numbers 0 (Sunday) to 6.");
    const target = raw.weeklyTarget ?? null;
    if (target !== null && !isInt(target, 1, 7)) bad("weeklyTarget must be 1 to 7.");
    if (!ok) return null;
    return {
      id: uuid(),
      kind: kindOf(items.length),
      sets: raw.sets,
      restS: raw.restS,
      transitionRestS: raw.transitionRestS ?? 0,
      items,
      weekdays: bank ? weekdays ?? (target ? null : ALL_WEEKDAYS) : null,
      weeklyTarget: bank && !weekdays ? target : null,
    };
  };

  const r = newRoutine(o.name!.trim(), false);
  o.days!.forEach((d, i) => {
    if (!isInt(d?.weekday, 0, 6)) return void errors.push(`days[${i}]: weekday must be 0 (Sunday) to 6.`);
    const day = r.days[d.weekday];
    day.label = typeof d.label === "string" ? d.label : "";
    (d.blocks ?? []).forEach((b, j) => {
      const made = block(b, `days[${i}].blocks[${j}]`, false);
      if (made) day.blocks.push(made);
    });
  });
  o.bank!.forEach((b, j) => {
    const made = block(b, `bank[${j}]`, true);
    if (made) r.bank.push(made);
  });
  return errors.length ? { errors } : { routine: r };
}
