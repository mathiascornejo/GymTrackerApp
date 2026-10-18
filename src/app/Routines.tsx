import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, MouseSensor, pointerWithin, TouchSensor, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useQuery } from "@tanstack/react-query";
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
  addBlock, addItem, containerBlocks, duplicate, exportRoutine, importRoutine, link, locate, moveBlock, newBlock, removeBlock,
  removeItem, routineStats, unlink, updateBlock, updateItem, weeklySets, type Block, type Routine, type Target,
} from "../routines/model";
import { BlockCard, WEEKDAY_NAMES, type BlockActions } from "./BlockCard";
import { ExerciseDetail, Sheet } from "./ExerciseSheet";
import { ConfirmSheet } from "./ConfirmSheet";
import { MoreMenu } from "./MoreMenu";
import { RoutinePicker } from "./RoutinePicker";
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

// With a pointer, a superset strip wins over the card under it, which wins over the column.
// Without one (keyboard), only cards are candidates so Arrow keys reorder; the Move to menu handles other days.
const collide: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) {
    const cards = args.droppableContainers.filter((c) => !String(c.id).startsWith("join:") && !String(c.id).startsWith("pager:") && !targetOf(String(c.id)));
    return closestCenter({ ...args, droppableContainers: cards });
  }
  const hits = pointerWithin(args);
  const pick =
    hits.find((h) => String(h.id).startsWith("pager:")) ??
    hits.find((h) => String(h.id).startsWith("join:")) ??
    hits.find((h) => !targetOf(String(h.id))) ??
    hits[0];
  return pick ? [pick] : closestCenter(args);
};

type Drag = { type: "pick"; ref: string } | { type: "block"; id: string };

function Column({ target, label, title, children, ids, action }: { target: Target; label: string; title: React.ReactNode; children: React.ReactNode; ids: string[]; action?: React.ReactNode }) {
  const id = containerId(target);
  const drop = useDroppable({ id });
  return (
    <section ref={drop.setNodeRef} className={`${s.column} ${drop.isOver ? s.columnOver : ""}`} aria-label={label}>
      <div className={s.columnTop}>
        <div className={s.columnHead}>{title}</div>
        {action}
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={s.columnBody}>{children}</div>
      </SortableContext>
      {ids.length === 0 && <p className={s.empty}>{target === "bank" ? "Accessories that repeat across days go here. Add one below." : "Rest day. Add an exercise to make this a training day."}</p>}
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
  // Keyboard drags reorder only: the superset strips would otherwise be the nearest target for Arrow keys.
  const [keyboardDrag, setKeyboardDrag] = useState(false);
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

  const edit = (fn: (r: Routine) => Routine) => routine && actions.update(routine.id, fn);
  const add = (ref: string, t: Target, index?: number) => edit((r) => addBlock(r, t, newBlock(ref, profile.default_rest_s), index));

  const blockActions = (b: Block): BlockActions => ({
    onSets: (v) => edit((r) => updateBlock(r, b.id, { sets: v })),
    onRest: (v) => edit((r) => updateBlock(r, b.id, { restS: v })),
    onTransition: (v) => edit((r) => updateBlock(r, b.id, { transitionRestS: v })),
    onReps: (itemId, patch) => edit((r) => updateItem(r, b.id, itemId, patch)),
    onRemoveItem: (itemId) => edit((r) => removeItem(r, b.id, itemId)),
    onRemoveBlock: () => edit((r) => removeBlock(r, b.id)),
    onView: setViewing,
    onUnlink: () => edit((r) => unlink(r, b.id)),
    onSchedule: (p) => edit((r) => updateBlock(r, b.id, p)),
    stepOf: (ref) => fromKg(profile.increments?.[ref] ?? defaultIncrementKg(info(ref)?.equipment ?? null), profile.weight_unit),
    onStep: (ref, v) => updateProfile.mutate({ increments: { ...(profile.increments ?? {}), [ref]: toKg(v, profile.weight_unit) } }),
  });

  const onDragStart = (e: DragStartEvent) => {
    setKeyboardDrag(e.activatorEvent instanceof KeyboardEvent);
    setDrag(e.active.data.current as Drag);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDrag(null);
    const { active, over } = e;
    const data = active.data.current as Drag | undefined;
    if (!routine || !over || !data) return;
    const overId = String(over.id).replace(/^pager:/, "");

    if (overId.startsWith("join:")) {
      const targetId = overId.slice(5);
      if (data.type === "pick") edit((r) => addItem(r, targetId, data.ref));
      else if (data.id !== targetId) edit((r) => link(r, [targetId, data.id]));
      return;
    }
    let target = targetOf(overId);
    let index: number | undefined;
    if (!target) {
      const at = locate(routine, overId);
      if (!at) return;
      target = at.target;
      index = at.index;
    }
    if (data.type === "pick") add(data.ref, target, index);
    else edit((r) => moveBlock(r, data.id, target!, index));
  };

  const order = Array.from({ length: 7 }, (_, i) => (profile.week_starts_on + i) % 7);
  const volume = routine ? Object.entries(weeklySets(routine, (ref) => info(ref)?.primary ?? [])).sort((a, b) => b[1] - a[1]) : [];

  const stats = routine ? routineStats(routine) : null;
  const current = pageDay === "bank" ? { target: "bank" as Target, label: "Accessory bank" } : { target: { day: pageDay }, label: WEEKDAY_NAMES[pageDay] };
  const nameOf = (id: string) => info(id)?.name ?? id;
  const overlayText = !drag
    ? ""
    : drag.type === "pick"
      ? nameOf(drag.ref)
      : (() => {
        const b = routine && locate(routine, drag.id)?.block;
        return b ? b.items.map((i) => nameOf(i.ref)).join(" + ") : "";
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

  const renderColumn = (target: Target) => {
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
      <Column key={cid} target={target} label={target === "bank" ? "Accessory bank" : WEEKDAY_NAMES[target.day]} title={title} ids={blocks.map((b) => b.id)}
        action={blocks.length >= 2 && !selecting ? <button className={f.quiet} onClick={() => setSelecting(true)}>Select</button> : undefined}>
        {blocks.map((b) => (
          <BlockCard
            key={b.id}
            block={b}
            bank={target === "bank"}
            dragging={drag !== null && !keyboardDrag && !(drag.type === "block" && drag.id === b.id)}
            info={info}
            actions={blockActions(b)}
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
            <button className={`${f.quiet} ${s.makeActive}`} onClick={() => actions.setActive(routine.id)}>Make active</button>
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
        <DndContext sensors={sensors} collisionDetection={collide} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}>
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
            <div className={s.board}>{renderColumn(pageDay === "bank" ? "bank" : { day: pageDay })}</div>
            {desktop && pickerOpen && (
              <aside className={s.sidePicker} aria-label="Add exercise">
                <div className={s.sheetTop}>
                  <h2 className={s.sheetTitle}>Add exercise</h2>
                  <button className={f.quiet} onClick={() => setPickerOpen(false)}>Close</button>
                </div>
                <RoutinePicker exercises={all} muscles={muscles} current={current} onAdd={(ref, t) => add(ref, t)} />
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
                <RoutinePicker exercises={all} muscles={muscles} current={current} onAdd={(ref, t) => add(ref, t)} />
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

          {selecting && (
            <div className={s.selectBar} role="region" aria-label="Link cards">
              <span className={s.selectCount} role="status">{selected.size} selected</span>
              {selected.size >= 2 && (
                <button
                  type="button" className={f.quiet}
                  onClick={() => {
                    edit((r) => link(r, [...selected]));
                    stopSelecting();
                  }}
                >
                  {selected.size >= 3 ? "Link as circuit" : "Link as superset"}
                </button>
              )}
              <button type="button" className={f.quiet} onClick={stopSelecting}>Cancel</button>
            </div>
          )}

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

          <DragOverlay>{drag ? <div className={s.overlay}>{overlayText}</div> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
