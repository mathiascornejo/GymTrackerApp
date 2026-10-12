import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, MouseSensor, pointerWithin, TouchSensor, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useCustomExercises } from "../data/customExercises";
import type { Profile } from "../data/profile";
import { useRoutineActions, useRoutines } from "../data/routines";
import { loadDataset } from "../exercises/dataset";
import { cap, facets } from "../exercises/query";
import {
  addBlock, addItem, containerBlocks, duplicate, exportRoutine, importRoutine, link, locate, moveBlock, newBlock, removeBlock,
  removeItem, routineStats, unlink, updateBlock, updateItem, weeklySets, type Block, type Routine, type Target,
} from "../routines/model";
import { BlockCard, WEEKDAY_NAMES, type BlockActions } from "./BlockCard";
import { Sheet } from "./ExerciseSheet";
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
    const cards = args.droppableContainers.filter((c) => !String(c.id).startsWith("join:") && !targetOf(String(c.id)));
    return closestCenter({ ...args, droppableContainers: cards });
  }
  const hits = pointerWithin(args);
  const pick = hits.find((h) => String(h.id).startsWith("join:")) ?? hits.find((h) => !targetOf(String(h.id))) ?? hits[0];
  return pick ? [pick] : closestCenter(args);
};

type Drag = { type: "pick"; ref: string } | { type: "block"; id: string };

function Column({ target, label, title, children, ids }: { target: Target; label: string; title: React.ReactNode; children: React.ReactNode; ids: string[] }) {
  const id = containerId(target);
  const drop = useDroppable({ id });
  return (
    <section ref={drop.setNodeRef} className={`${s.column} ${drop.isOver ? s.columnOver : ""} ${target === "bank" ? s.bank : ""}`} aria-label={label}>
      <div className={s.columnHead}>{title}</div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={s.columnBody}>{children}</div>
      </SortableContext>
      {ids.length === 0 && <p className={s.empty}>{target === "bank" ? "Accessories that repeat across days go here." : "Rest day"}</p>}
    </section>
  );
}

export function Routines({ profile }: { profile: Profile }) {
  const routines = useRoutines();
  const actions = useRoutineActions();
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

  const [selected, setSelected] = useState<string[]>([]);
  const [pageDay, setPageDay] = useState<number | "bank">(() => new Date().getDay());
  const [drag, setDrag] = useState<Drag | null>(null);
  // Keyboard drags reorder only: the superset strips would otherwise be the nearest target for Arrow keys.
  const [keyboardDrag, setKeyboardDrag] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  // A new routine is only stored when saved; until then it is just a name.
  const [draft, setDraft] = useState("");
  useEffect(() => setSelected([]), [routine?.id]);

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
    onSelect: (on) => setSelected((cur) => (on ? [...cur, b.id] : cur.filter((x) => x !== b.id))),
    onSets: (v) => edit((r) => updateBlock(r, b.id, { sets: v })),
    onRest: (v) => edit((r) => updateBlock(r, b.id, { restS: v })),
    onTransition: (v) => edit((r) => updateBlock(r, b.id, { transitionRestS: v })),
    onReps: (itemId, patch) => edit((r) => updateItem(r, b.id, itemId, patch)),
    onRemoveItem: (itemId) => edit((r) => removeItem(r, b.id, itemId)),
    onRemoveBlock: () => edit((r) => removeBlock(r, b.id)),
    onUnlink: () => edit((r) => unlink(r, b.id)),
    onMove: (to) => edit((r) => moveBlock(r, b.id, to)),
    onSchedule: (p) => edit((r) => updateBlock(r, b.id, p)),
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
    const overId = String(over.id);

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
        "Accessory bank"
      ) : (
        <>
          <span>{WEEKDAY_NAMES[target.day]}</span>
          <input
            key={`${routine.id}-${target.day}`}
            className={s.dayLabel}
            aria-label={`${WEEKDAY_NAMES[target.day]} label`}
            placeholder="Label"
            defaultValue={day!.label}
            onBlur={(e) =>
              e.target.value.trim() !== day!.label &&
              edit((r) => ({ ...r, days: r.days.map((d) => (d.weekday === target.day ? { ...d, label: e.target.value.trim() } : d)) }))
            }
          />
        </>
      );
    return (
      <Column key={cid} target={target} label={target === "bank" ? "Accessory bank" : WEEKDAY_NAMES[target.day]} title={title} ids={blocks.map((b) => b.id)}>
        {blocks.map((b) => (
          <BlockCard
            key={b.id}
            block={b}
            bank={target === "bank"}
            container={cid}
            selected={selected.includes(b.id)}
            dragging={drag !== null && !keyboardDrag && !(drag.type === "block" && drag.id === b.id)}
            info={info}
            actions={blockActions(b)}
          />
        ))}
      </Column>
    );
  };

  return (
    <div>
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
        {routine && (
          <label>
            Name
            <input key={routine.id} className={f.input} defaultValue={routine.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== routine.name && edit((r) => ({ ...r, name: e.target.value.trim() }))} />
          </label>
        )}
        <form
          className={s.newRoutine}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            setPickedId(actions.create(draft.trim()));
            setDraft("");
          }}
        >
          <label>
            New routine name
            <input className={f.input} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button className={f.button} type="submit" disabled={!draft.trim()}>Save routine</button>
        </form>
        <div className={s.toolbarButtons}>
          {routine && !routine.isActive && !routine.archivedAt && (
            <button className={f.quiet} onClick={() => actions.setActive(routine.id)}>Make active</button>
          )}
          {routine && <button className={f.quiet} onClick={() => setPickedId(actions.addImported(duplicate(routine, `${routine.name} copy`)))}>Duplicate</button>}
          {routine && (
            <button className={f.quiet} onClick={() => edit((r) => ({ ...r, archivedAt: r.archivedAt ? null : new Date().toISOString(), isActive: false }))}>
              {routine.archivedAt ? "Restore" : "Archive"}
            </button>
          )}
          {routine && (
            <button
              className={f.quiet}
              onClick={() => window.confirm(`Delete ${routine.name}? Logged sessions keep their sets.`) && (actions.remove(routine.id), setPickedId(null))}
            >
              Delete routine
            </button>
          )}
          {routine && <button className={f.quiet} onClick={exportJson}>Export JSON</button>}
          <label className={`${f.quiet} ${s.fileBtn}`}>
            Import JSON
            <input type="file" accept="application/json,.json" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>

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
          <h2 className={s.overviewName}>
            {routine.name}
            {routine.isActive && <span className={s.badge}>Active</span>}
            {routine.archivedAt && <span className={s.badge}>Archived</span>}
          </h2>
          <dl className={s.stats}>
            <div><dt>Training days</dt><dd>{stats!.trainingDays}</dd></div>
            <div><dt>Exercises</dt><dd>{stats!.exercises}</dd></div>
            <div><dt>Sets per week</dt><dd>{stats!.weeklySets}</dd></div>
          </dl>
          {volume.length > 0 && <p className={f.note}>Most work: {volume.slice(0, 3).map(([m, n]) => `${cap(m)} (${n})`).join(", ")}</p>}
        </section>
      )}

      {!routine ? (
        <p className={f.lead}>Create a routine to plan your week, or import one from a JSON file.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={collide} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}>
          {!desktop && (
            <div className={s.pager} role="tablist" aria-label="Day">
              {[...order, "bank" as const].map((d) => (
                <button key={d} role="tab" aria-selected={pageDay === d} className={s.pagerBtn} onClick={() => setPageDay(d)}>
                  {d === "bank" ? "Bank" : WEEKDAY_NAMES[d].slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          {selected.length >= 2 && (
            <div className={s.linkBar}>
              <button className={f.button} onClick={() => (edit((r) => link(r, selected)), setSelected([]))}>
                {selected.length >= 3 ? "Link as circuit" : "Link as superset"}
              </button>
              <button className={f.quiet} onClick={() => setSelected([])}>Clear selection</button>
            </div>
          )}

          <div className={s.board}>
            {desktop ? order.map((d) => renderColumn({ day: d })) : pageDay !== "bank" ? renderColumn({ day: pageDay }) : null}
          </div>
          {(desktop || pageDay === "bank") && <div className={s.bankLane}>{renderColumn("bank")}</div>}

          {desktop ? (
            <RoutinePicker exercises={all} muscles={muscles} onAdd={(ref, t) => add(ref, t)} />
          ) : (
            <>
              <button className={`${f.button} ${s.addFab}`} onClick={() => setPickerOpen(true)}>Add exercise</button>
              <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} label="Add exercise">
                <div className={s.sheetTop}>
                  <h2 className={s.sheetTitle}>Add exercise</h2>
                  <button className={f.quiet} onClick={() => setPickerOpen(false)}>Done</button>
                </div>
                <RoutinePicker exercises={all} muscles={muscles} onAdd={(ref, t) => add(ref, t)} />
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

          <DragOverlay>{drag ? <div className={s.overlay}>{overlayText}</div> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
