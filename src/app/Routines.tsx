import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, MouseSensor, pointerWithin, TouchSensor, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useQuery } from "@tanstack/react-query";
import { getEventCoordinates } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useCustomExercises } from "../data/customExercises";
import type { Profile } from "../data/profile";
import { useUpdateProfile } from "../data/profile";
import { useRoutineActions, useRoutines } from "../data/routines";
import { loadDataset } from "../exercises/dataset";
import { cap, facets } from "../exercises/query";
import { defaultIncrementKg } from "../session/recommend";
import { fromKg, toKg } from "../units";
import {
  addBlock, addItem, containerBlocks, duplicate, exportRoutine, extractItem, importRoutine, link, locate, moveBlock, newBlock, removeBlock,
  removeItem, routineStats, unlink, updateBlock, updateItem, weeklySets, type Block, type Routine, type Target,
} from "../routines/model";
import { dropIntent, insertAfter } from "../routines/dropIntent";
import { BlockCard, blockMeta, DragCard, WEEKDAY_NAMES, type BlockActions } from "./BlockCard";
import { ExerciseDetail, Sheet } from "./ExerciseSheet";
import { ConfirmSheet } from "./ConfirmSheet";
import { MoreMenu } from "./MoreMenu";
import { RoutinePicker, type Place } from "./RoutinePicker";
import f from "./Form.module.css";
import s from "./Routines.module.css";

const desktopQuery = "(min-width: 1024px)";
const useIsDesktop = () =>
  useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(desktopQuery);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(desktopQuery).matches,
  );

const containerId = (t: Target) => (t === "bank" ? "bank" : `day:${t.day}`);
const targetOf = (id: string): Target | null => (id === "bank" ? "bank" : id.startsWith("day:") ? { day: Number(id.slice(4)) } : null);

// dnd-kit moves the pointer by the page's scroll, which suits cards but not the sticky day chips, so chips are tested against the real pointer.
const pointer = { x: 0, y: 0 };

// With a pointer, a day chip wins over the card under it, which wins over the column. Over nothing, there is no target, so releasing cancels.
// Without a pointer (keyboard), only cards are candidates so Arrow keys reorder.
const collide: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) {
    const cards = args.droppableContainers.filter((c) => !String(c.id).startsWith("pager:") && !targetOf(String(c.id)));
    return closestCenter({ ...args, droppableContainers: cards });
  }
  const chip = args.droppableContainers.find((c) => {
    const r = String(c.id).startsWith("pager:") ? c.node.current?.getBoundingClientRect() : undefined;
    return r && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
  });
  if (chip) return [{ id: chip.id, data: { droppableContainer: chip, value: 0 } }];
  const hits = pointerWithin(args).filter((h) => !String(h.id).startsWith("pager:"));
  const pick = hits.find((h) => !targetOf(String(h.id))) ?? hits[0];
  return pick ? [pick] : [];
};

const HOLD_TO_JOIN_MS = 600;
const HOVER_TO_SWITCH_MS = 500;
const UNDO_MS = 6000;

type Drag = { type: "pick"; ref: string } | { type: "block"; id: string } | { type: "item"; blockId: string; itemId: string };

/** `parked` keeps the column the dragged card came from mounted but out of sight after the page moves to another day, so the drag survives. */
function Column({ target, label, title, children, ids, parked, dragging, action }: { target: Target; label: string; title: React.ReactNode; children: React.ReactNode; ids: string[]; parked: boolean; dragging: boolean; action?: React.ReactNode }) {
  const id = containerId(target);
  const drop = useDroppable({ id, disabled: parked });
  return (
    <section ref={drop.setNodeRef} className={`${s.column} ${drop.isOver ? s.columnOver : ""} ${parked ? s.parked : ""}`} aria-label={label}>
      <div className={s.columnTop}>
        <div className={s.columnHead}>{title}</div>
        {action}
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={s.columnBody}>{children}</div>
      </SortableContext>
      {ids.length === 0 && (
        <p className={`${s.empty} ${dragging && drop.isOver ? s.emptyOver : ""}`}>
          {dragging && drop.isOver
            ? `Drop to add to ${label}`
            : target === "bank" ? "Accessories that repeat across days go here. Add one below." : "Rest day. Add an exercise to make this a training day."}
        </p>
      )}
    </section>
  );
}

/** A day button that is also a drop target: drag a card onto it to move the card to that day. */
function DayButton({ id, label, count, selected, onSelect }: { id: string; label: string; count: number; selected: boolean; onSelect: () => void }) {
  const drop = useDroppable({ id: `pager:${id}` });
  return (
    <button ref={drop.setNodeRef} role="tab" aria-selected={selected} className={`${s.pagerBtn} ${drop.isOver ? s.pagerOver : ""}`} onClick={onSelect}>
      {label}
      {count > 0 && <span className={s.pagerCount}>{count}</span>}
    </button>
  );
}

export function Routines({ profile }: { profile: Profile }) {
  const routines = useRoutines();
  const actions = useRoutineActions();
  const updateProfile = useUpdateProfile();
  const dataset = useQuery({ queryKey: ["dataset"], queryFn: loadDataset, staleTime: Infinity });
  const custom = useCustomExercises();
  const desktop = useIsDesktop();

  const all = useMemo(() => [...(dataset.data ?? []), ...(custom.data ?? [])], [dataset.data, custom.data]);
  const byRef = useMemo(() => new Map(all.map((e) => [e.ref, e])), [all]);
  const info = (ref: string) => byRef.get(ref);
  const muscles = useMemo(() => facets(all).muscle, [all]);

  const list = routines.data ?? [];
  const [pickedId, setPickedId] = useState<string | null>(null);
  const routine: Routine | undefined =
    list.find((r) => r.id === pickedId) ?? list.find((r) => r.isActive && !r.archivedAt) ?? list.find((r) => !r.archivedAt) ?? list[0];

  const [pageDay, setPageDay] = useState<number | "bank">(() => new Date().getDay());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dragFrom, setDragFrom] = useState<Target | null>(null);
  // Switching days mid-drag must not shorten the page: the scroll would reset and the chips would move from under the pointer.
  const board = useRef<HTMLDivElement>(null);
  const [boardMin, setBoardMin] = useState<number | undefined>();
  // Auto-scroll would drag the page away from under a pointer resting on the sticky chips.
  const [overChip, setOverChip] = useState(false);
  // The card the pointer has rested on long enough that releasing makes a superset.
  const [joinArmed, setJoinArmed] = useState<string | null>(null);
  const armedRef = useRef<string | null>(null);
  // For a picker drag: the card under the pointer and which side of it the new exercise will land on. Cards do not move apart for these.
  const [pickAt, setPickAt] = useState<{ id: string; after: boolean } | null>(null);
  const pickRef = useRef<typeof pickAt>(null);
  const hold = useRef<{ key: string | null; timer?: number }>({ key: null });
  const hover = useRef<number | undefined>(undefined);
  const dragging = useRef(false);
  const [toast, setToast] = useState<{ text: string; routineId: string; before: Routine } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), UNDO_MS);
    return () => window.clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!drag) return;
    const track = (e: PointerEvent) => ((pointer.x = e.clientX), (pointer.y = e.clientY));
    window.addEventListener("pointermove", track);
    return () => window.removeEventListener("pointermove", track);
  }, [drag]);
  // Selection mode: tick cards in the day being viewed, then link them into a superset or circuit.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((o) => new Set(o.has(id) ? [...o].filter((x) => x !== id) : [...o, id]));
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  useEffect(stopSelecting, [pageDay, pickedId]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  // One popup for both: a new routine is only stored when saved, and a rename only applies on save.
  const [naming, setNaming] = useState<"new" | "rename" | { day: number } | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const openNaming = (mode: "new" | "rename" | { day: number }) => {
    setDraft(mode === "new" ? "" : mode === "rename" ? routine?.name ?? "" : routine?.days.find((d) => d.weekday === mode.day)?.label ?? "");
    setNaming(mode);
  };
  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (typeof naming === "object" && naming) {
      // A day label may be empty: that clears it.
      const day = naming.day;
      edit((r) => ({ ...r, days: r.days.map((d) => (d.weekday === day ? { ...d, label: name } : d)) }));
    } else if (!name) return;
    else if (naming === "new") setPickedId(actions.create(name));
    else if (name !== routine?.name) edit((r) => ({ ...r, name }));
    setNaming(null);
  };
  const namingTitle = naming === "new" ? "New routine" : naming === "rename" ? "Rename routine" : naming ? `${WEEKDAY_NAMES[naming.day]} label` : "";

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (routines.error)
    return <p className={f.error} role="alert">Could not load your routines: {routines.error.message}</p>;
  if (routines.isPending) return null;

  // Any edit hides the undo toast; one that passes `said` shows a new one. Undo restores the routine as it was just before.
  const edit = (fn: (r: Routine) => Routine, said?: string) => {
    if (!routine) return;
    let before: Routine | undefined;
    actions.update(routine.id, (r) => ((before = r), fn(r)));
    setToast(said && before ? { text: said, routineId: routine.id, before } : null);
  };
  const add = (ref: string, t: Target, index?: number) => edit((r) => addBlock(r, t, newBlock(ref, profile.default_rest_s), index));

  const blockActions = (b: Block, at: Target): BlockActions => ({
    onSets: (v) => edit((r) => updateBlock(r, b.id, { sets: v })),
    onRest: (v) => edit((r) => updateBlock(r, b.id, { restS: v })),
    onTransition: (v) => edit((r) => updateBlock(r, b.id, { transitionRestS: v })),
    onReps: (itemId, patch) => edit((r) => updateItem(r, b.id, itemId, patch)),
    onRemoveItem: (itemId) => edit((r) => removeItem(r, b.id, itemId)),
    onRemoveBlock: () => edit((r) => removeBlock(r, b.id)),
    onView: setViewing,
    onUnlink: () => edit((r) => unlink(r, b.id)),
    moveTargets: places.filter((p) => containerId(p.target) !== containerId(at)),
    onMove: (t) => edit((r) => moveBlock(r, b.id, t), `Moved to ${where(t)}`),
    onSchedule: (p) => edit((r) => updateBlock(r, b.id, p)),
    stepOf: (ref) => fromKg(profile.increments?.[ref] ?? defaultIncrementKg(info(ref)?.equipment ?? null), profile.weight_unit),
    onStep: (ref, v) => updateProfile.mutate({ increments: { ...(profile.increments ?? {}), [ref]: toKg(v, profile.weight_unit) } }),
  });

  const setArmed = (id: string | null) => {
    armedRef.current = id;
    setJoinArmed(id);
  };
  const setPick = (v: typeof pickAt) => {
    pickRef.current = v;
    setPickAt((o) => (o?.id === v?.id && o?.after === v?.after ? o : v));
  };
  const resetDrag = () => {
    setPick(null);
    window.clearTimeout(hold.current.timer);
    hold.current.key = null;
    window.clearTimeout(hover.current);
    dragging.current = false;
    setArmed(null);
    setDrag(null);
    setDragFrom(null);
    setBoardMin(undefined);
    setOverChip(false);
  };
  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as Drag;
    dragging.current = true;
    setDrag(data);
    setBoardMin(board.current?.offsetHeight);
    const owner = data.type === "block" ? data.id : data.type === "item" ? data.blockId : null;
    setDragFrom(owner && routine ? locate(routine, owner)?.target ?? null : null);
  };
  // Holding the pointer over the middle of another card arms a superset; moving off the middle or the card disarms it.
  const onDragMove = (e: DragMoveEvent) => {
    const data = e.active.data.current as Drag | undefined;
    const y = getEventCoordinates(e.activatorEvent)?.y;
    const id = e.over ? String(e.over.id) : null;
    const overCard = e.over && id && y !== undefined && !targetOf(id) && !id.startsWith("pager:");
    setPick(data?.type === "pick" && overCard ? { id: id!, after: insertAfter(y! + e.delta.y, e.over!.rect) } : null);
    const key =
      data && data.type !== "item" && e.over && id && y !== undefined && !targetOf(id) && !id.startsWith("pager:") && !(data.type === "block" && data.id === id) &&
      dropIntent(y + e.delta.y, e.over.rect) === "center"
        ? id
        : null;
    if (key === hold.current.key) return;
    window.clearTimeout(hold.current.timer);
    hold.current.key = key;
    setArmed(null);
    if (key) hold.current.timer = window.setTimeout(() => setArmed(key), HOLD_TO_JOIN_MS);
  };
  // Resting on a day chip switches to that day, so the card can be dropped at an exact spot.
  const onDragOver = (e: DragOverEvent) => {
    window.clearTimeout(hover.current);
    if (!dragging.current) return; // dnd-kit can report one more "over" after the drop; it must not start a switch
    const id = e.over ? String(e.over.id) : "";
    setOverChip(id.startsWith("pager:"));
    if (!id.startsWith("pager:")) return;
    const day = id === "pager:bank" ? "bank" : Number(id.slice(10));
    hover.current = window.setTimeout(() => setPageDay(day), HOVER_TO_SWITCH_MS);
  };
  const where = (t: Target) => (t === "bank" ? "the accessory bank" : WEEKDAY_NAMES[t.day]);
  const onDragEnd = (e: DragEndEvent) => {
    const armed = armedRef.current;
    const pickSide = pickRef.current;
    resetDrag();
    const { active, over } = e;
    const data = active.data.current as Drag | undefined;
    if (!routine || !over || !data) return;
    const overId = String(over.id).replace(/^pager:/, "");

    if (data.type === "item") {
      // An exercise pulled out of a superset lands as its own block; it never joins another.
      let t = targetOf(overId);
      let at: number | undefined;
      if (!t) {
        const hit = locate(routine, overId);
        if (!hit) return;
        t = hit.target;
        at = hit.index;
      }
      edit((r) => extractItem(r, data.blockId, data.itemId, t!, at), "Moved out of the superset");
      return;
    }

    if (armed === overId && !targetOf(overId)) {
      if (data.type === "pick") edit((r) => addItem(r, overId, data.ref), "Made a superset");
      else if (data.id !== overId) edit((r) => link(r, [overId, data.id]), "Made a superset");
      return;
    }
    let target = targetOf(overId);
    let index: number | undefined;
    if (!target) {
      const at = locate(routine, overId);
      if (!at) return;
      target = at.target;
      index = at.index + (data.type === "pick" && pickSide?.id === overId && pickSide.after ? 1 : 0);
    }
    if (data.type === "pick") edit((r) => addBlock(r, target!, newBlock(data.ref, profile.default_rest_s), index), `Added to ${where(target)}`);
    else {
      const from = locate(routine, data.id)?.target;
      edit((r) => moveBlock(r, data.id, target!, index), JSON.stringify(from) === JSON.stringify(target) ? undefined : `Moved to ${where(target)}`);
    }
  };

  const visible: Target = pageDay === "bank" ? "bank" : { day: pageDay };
  // After a hover switches the page, the column the dragged card came from stays mounted (hidden) until the drop.
  const columns = dragFrom && containerId(dragFrom) !== containerId(visible) ? [visible, dragFrom] : [visible];
  const order = Array.from({ length: 7 }, (_, i) => (profile.week_starts_on + i) % 7);
  const places: Place[] = [...order.map((d) => ({ target: { day: d } as Target, label: WEEKDAY_NAMES[d] })), { target: "bank", label: "Accessory bank" }];
  const volume = routine ? Object.entries(weeklySets(routine, (ref) => info(ref)?.primary ?? [])).sort((a, b) => b[1] - a[1]) : [];

  const stats = routine ? routineStats(routine) : null;
  const current = pageDay === "bank" ? { target: "bank" as Target, label: "Accessory bank" } : { target: { day: pageDay }, label: WEEKDAY_NAMES[pageDay] };
  const nameOf = (id: string) => info(id)?.name ?? id;
  const overlay = (() => {
    if (!drag || !routine) return null;
    const blocks = routine.days.flatMap((d) => d.blocks).concat(routine.bank);
    if (drag.type === "pick") return { names: nameOf(drag.ref), meta: blockMeta(newBlock(drag.ref, profile.default_rest_s), false), block: false };
    if (drag.type === "item") {
      const from = blocks.find((b) => b.id === drag.blockId);
      const item = from?.items.find((i) => i.id === drag.itemId);
      return from && item ? { names: nameOf(item.ref), meta: blockMeta({ ...from, kind: "single", items: [item] }, false), block: false } : null;
    }
    const b = locate(routine, drag.id)?.block;
    return b ? { names: b.items.map((i) => nameOf(i.ref)).join(" + "), meta: blockMeta(b, locate(routine, drag.id)?.target === "bank"), block: true } : null;
  })();

  const exportJson = () => {
    if (!routine) return;
    const blob = new Blob([JSON.stringify(exportRoutine(routine), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${routine.name.replace(/[^\w-]+/g, "-").toLowerCase() || "routine"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setImportErrors([]);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return setImportErrors(["This file is not valid JSON."]);
    }
    // The dataset loads lazily; wait for it so a fast import never reports real exercises as unknown.
    const known = new Set([...(dataset.data ?? (await loadDataset())).map((e) => e.ref), ...(custom.data ?? []).map((e) => e.ref)]);
    const out = importRoutine(json, (ref) => known.has(ref));
    if ("errors" in out) return setImportErrors(out.errors);
    setPickedId(actions.addImported(out.routine));
  };

  const renderColumn = (target: Target, parked: boolean) => {
    if (!routine) return null;
    const blocks = containerBlocks(routine, target);
    const cid = containerId(target);
    const day = target === "bank" ? null : routine.days.find((d) => d.weekday === target.day)!;
    const title =
      target === "bank" ? (
        <>
          <span>Accessory bank</span>
          <span className={s.dayLabelRow}>
            <span className={s.dayLabelText}>Repeats across days</span>
          </span>
        </>
      ) : (
        <>
          <span>{WEEKDAY_NAMES[target.day]}</span>
          <span className={s.dayLabelRow}>
            <span className={s.dayLabelText}>{day!.label || <span className={s.dayLabelEmpty}>No label</span>}</span>
            <button className={s.pencil} aria-label={`Edit ${WEEKDAY_NAMES[target.day]} label`} onClick={() => openNaming({ day: target.day })}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          </span>
        </>
      );
    return (
      <Column key={cid} target={target} label={target === "bank" ? "Accessory bank" : WEEKDAY_NAMES[target.day]} title={title} ids={blocks.map((b) => b.id)} parked={parked} dragging={drag !== null}
        action={blocks.length >= 2 && !selecting ? <button className={f.quiet} onClick={() => setSelecting(true)}>Select</button> : undefined}>
        {blocks.map((b) => (
          <BlockCard
            key={b.id}
            block={b}
            bank={target === "bank"}
            joinArmed={joinArmed === b.id}
            insert={pickAt?.id === b.id ? (pickAt.after ? "after" : "before") : null}
            parked={parked}
            info={info}
            actions={blockActions(b, target)}
            selecting={selecting}
            selected={selected.has(b.id)}
            onToggle={() => toggle(b.id)}
            unit={profile.weight_unit}
          />
        ))}
      </Column>
    );
  };

  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <label>
          Routine
          <select aria-label="Routine" className={f.input} value={routine?.id ?? ""} onChange={(e) => setPickedId(e.target.value)} disabled={!list.length}>
            {!list.length && <option value="">No routines yet</option>}
            {list.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.isActive ? " (active)" : r.archivedAt ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button className={`${f.button} ${s.newRoutine}`} onClick={() => openNaming("new")}>New routine</button>
      </div>

      <input
        ref={fileInput} type="file" accept="application/json,.json" className={s.visuallyHidden} tabIndex={-1} aria-hidden="true"
        onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }}
      />

      <Sheet open={naming !== null} onClose={() => setNaming(null)} label={namingTitle}>
        <form onSubmit={saveName}>
          <div className={s.sheetTop}>
            <h2 className={s.sheetTitle}>{namingTitle}</h2>
            <button type="button" className={f.quiet} onClick={() => setNaming(null)}>Cancel</button>
          </div>
          <label>
            {typeof naming === "object" && naming ? "Label" : "Routine name"}
            <input autoFocus className={f.input} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button className={f.button} type="submit" disabled={typeof naming !== "object" && !draft.trim()} style={{ marginTop: 16 }}>
            {typeof naming === "object" && naming ? "Save label" : "Save routine"}
          </button>
        </form>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete && routine !== undefined}
        title={`Delete ${routine?.name ?? "routine"}?`}
        body="Logged sessions keep their sets."
        confirmLabel="Delete routine"
        destructive
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (routine) actions.remove(routine.id);
          setPickedId(null);
          setConfirmDelete(false);
        }}
      />

      <p className={f.note} role="status" style={{ margin: "8px 0 0" }}>{actions.saving ? "Saving…" : "All changes saved"}</p>
      {actions.error && <p className={f.error} role="alert">Could not save your changes: {actions.error.message}. The routine was reloaded from your account.</p>}
      {importErrors.length > 0 && (
        <div className={f.error} role="alert">
          <p style={{ margin: 0 }}>This file could not be imported:</p>
          <ul>{importErrors.slice(0, 8).map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      )}

      {routine && (
        <section className={s.overview} aria-label="Routine overview">
          <div className={s.overviewHead}>
            <h2 className={s.overviewName}>
              {routine.name}
              <button className={s.pencil} aria-label="Rename routine" onClick={() => openNaming("rename")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
              {routine.isActive && <span className={s.badge}>Active</span>}
              {routine.archivedAt && <span className={s.badge}>Archived</span>}
            </h2>
            <MoreMenu
              label="More"
              items={[
                { label: "Duplicate", onSelect: () => setPickedId(actions.addImported(duplicate(routine, `${routine.name} copy`))) },
                { label: "Export JSON", onSelect: exportJson },
                { label: "Import JSON", onSelect: () => fileInput.current?.click() },
                { label: "Delete routine", onSelect: () => setConfirmDelete(true), destructive: true },
              ]}
            />
          </div>
          {!routine.isActive && !routine.archivedAt && (
            <button className={`${f.quiet} ${s.makeActive}`} onClick={() => { setToast(null); actions.setActive(routine.id); }}>Make active</button>
          )}
          <dl className={s.stats}>
            <div><dt>Training days</dt><dd>{stats!.trainingDays}</dd></div>
            <div><dt>Exercises</dt><dd>{stats!.exercises}</dd></div>
            <div><dt>Sets per week</dt><dd>{stats!.weeklySets}</dd></div>
          </dl>
          {volume.length > 0 && <p className={`${f.note} ${s.mostWork}`}>Most work: {volume.slice(0, 3).map(([m, n]) => `${cap(m)} (${n})`).join(", ")}</p>}
        </section>
      )}

      {!routine ? (
        <>
          <p className={f.lead}>Create a routine to plan your week, or import one from a JSON file.</p>
          <button className={f.quiet} onClick={() => fileInput.current?.click()}>Import JSON</button>
        </>
      ) : (
        <DndContext sensors={sensors} collisionDetection={collide} autoScroll={!overChip} onDragStart={onDragStart} onDragMove={onDragMove} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={resetDrag}>
          <div className={s.pager} role="tablist" aria-label="Day">
            {[...order, "bank" as const].map((d) => (
              <DayButton
                key={d}
                id={d === "bank" ? "bank" : `day:${d}`}
                label={d === "bank" ? "Bank" : WEEKDAY_NAMES[d].slice(0, 3)}
                count={d === "bank" ? routine.bank.length : containerBlocks(routine, { day: d }).length}
                selected={pageDay === d}
                onSelect={() => setPageDay(d)}
              />
            ))}
          </div>

          {/* Desktop docks the picker beside the board (not a modal sheet) so exercises can still be dragged onto a day. */}
          <div className={desktop && pickerOpen ? s.boardSplit : undefined}>
            <div ref={board} className={s.board} style={{ minHeight: boardMin }}>
              {columns.map((t) => renderColumn(t, containerId(t) !== containerId(visible)))}
            </div>
            {desktop && pickerOpen && (
              <aside className={s.sidePicker} aria-label="Add exercise">
                <div className={s.sheetTop}>
                  <h2 className={s.sheetTitle}>Add exercise</h2>
                  <button className={f.quiet} onClick={() => setPickerOpen(false)}>Close</button>
                </div>
                <RoutinePicker exercises={all} muscles={muscles} current={current} places={places} onAdd={(ref, t) => add(ref, t)} draggable />
              </aside>
            )}
          </div>

          {!(desktop && pickerOpen) && !selecting && <button className={`${f.button} ${s.addFab}`} onClick={() => setPickerOpen(true)}>Add exercise</button>}
          {!desktop && (
            <>
              <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} label="Add exercise">
                <div className={s.sheetTop}>
                  <h2 className={s.sheetTitle}>Add exercise</h2>
                  <button className={f.quiet} onClick={() => setPickerOpen(false)}>Done</button>
                </div>
                <RoutinePicker exercises={all} muscles={muscles} current={current} places={places} onAdd={(ref, t) => add(ref, t)} draggable={false} />
              </Sheet>
            </>
          )}

          <section className={s.volume} aria-label="Weekly sets per muscle">
            <h2 className={f.groupTitle}>Weekly sets per muscle</h2>
            {volume.length === 0 ? (
              <p className={f.note}>Add exercises to see weekly sets per muscle.</p>
            ) : (
              <ul>
                {volume.map(([m, n]) => (
                  <li key={m}><span>{cap(m)}</span><span>{n}</span></li>
                ))}
              </ul>
            )}
          </section>

          <Sheet open={viewing !== null} onClose={() => setViewing(null)} label={info(viewing ?? "")?.name ?? "Exercise"}>
            {viewing && info(viewing) && (
              <ExerciseDetail
                exercise={info(viewing)!}
                profile={profile}
                onClose={() => setViewing(null)}
                // Custom exercises are edited in the library, so this is the one path that leaves the tab.
                onEdit={() => { window.location.hash = `#/library/${encodeURIComponent(viewing)}`; }}
              />
            )}
          </Sheet>

          {selecting && (
            <div className={s.selectBar} role="region" aria-label="Link cards">
              <span className={s.selectCount} role="status">{selected.size} selected</span>
              {selected.size >= 2 && (
                <button
                  type="button" className={f.quiet}
                  onClick={() => {
                    const circuit = selected.size >= 3;
                    edit((r) => link(r, [...selected]), circuit ? "Made a circuit" : "Made a superset");
                    stopSelecting();
                  }}
                >
                  {selected.size >= 3 ? "Link as circuit" : "Link as superset"}
                </button>
              )}
              <button type="button" className={f.quiet} onClick={stopSelecting}>Cancel</button>
            </div>
          )}

          {toast && toast.routineId === routine.id && (
            <div className={s.toast} role="status">
              <span>{toast.text}</span>
              <button type="button" className={f.quiet} onClick={() => { actions.update(toast.routineId, () => toast.before); setToast(null); }}>Undo</button>
            </div>
          )}

          <DragOverlay>{overlay && <DragCard {...overlay} />}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
