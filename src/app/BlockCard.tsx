import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Exercise } from "../exercises/types";
import { cap } from "../exercises/query";
import { ALL_WEEKDAYS, pairNote, type Block, type Target } from "../routines/model";
import { Stepper } from "./Stepper";
import s from "./Routines.module.css";

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export type BlockActions = {
  onSets: (v: number) => void;
  onRest: (v: number) => void;
  onTransition: (v: number) => void;
  onReps: (itemId: string, patch: { repMin?: number; repMax?: number }) => void;
  onRemoveItem: (itemId: string) => void;
  onRemoveBlock: () => void;
  onUnlink: () => void;
  onMove: (to: Target) => void;
  onSchedule: (patch: { weekdays: number[] | null; weeklyTarget: number | null }) => void;
  /** Progression step for an exercise, in the display unit, and how to change it (given in the display unit). */
  stepOf: (ref: string) => number;
  onStep: (ref: string, value: number) => void;
};

const toTarget = (v: string): Target => (v === "bank" ? "bank" : { day: Number(v) });

/** Drag handle for one exercise inside a superset; dropping it on a day or card makes it its own block. */
function ItemGrip({ blockId, itemId, name }: { blockId: string; itemId: string; name: string }) {
  const drag = useDraggable({ id: `item:${itemId}`, data: { type: "item", blockId, itemId } });
  return (
    <button type="button" className={s.itemGrip} aria-label={`Drag ${name} out of the superset`} ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}>
      ⠿
    </button>
  );
}

export function BlockCard({
  block, bank, container, dragging, info, actions, unit,
}: {
  block: Block;
  bank: boolean;
  container: string;
  /** True while something else is being dragged, which reveals the superset drop strip. */
  dragging: boolean;
  info: (ref: string) => Exercise | undefined;
  actions: BlockActions;
  unit: string;
}) {
  const sortable = useSortable({ id: block.id, data: { type: "block", id: block.id } });
  const join = useDroppable({ id: `join:${block.id}` });
  const names = block.items.map((i) => info(i.ref)?.name ?? i.ref.replace(/^\w+:/, ""));
  const note = pairNote(block, (ref) => {
    const e = info(ref);
    return e && { force: e.force, primary: e.primary };
  });
  const mode = block.weeklyTarget !== null && block.weekdays === null ? "week" : block.weekdays?.length === 7 ? "daily" : "days";

  return (
    <article
      ref={sortable.setNodeRef}
      className={`${s.card} ${sortable.isDragging ? s.cardDragging : ""}`}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      aria-label={names.join(" and ")}
    >
      <header className={s.cardHead}>
        <button type="button" className={s.grip} aria-label={`Reorder ${names.join(" and ")}`} {...sortable.attributes} {...sortable.listeners}>
          ⠿
        </button>
        <button type="button" className={s.iconBtn} aria-label={`Remove ${names.join(" and ")}`} onClick={actions.onRemoveBlock}>
          ×
        </button>
      </header>

      <ul className={s.items}>
        {block.items.map((item, i) => (
          <li key={item.id}>
            <div className={s.itemName}>
              {block.items.length > 1 && <ItemGrip blockId={block.id} itemId={item.id} name={names[i]} />}
              <a href={`#/library/${encodeURIComponent(item.ref)}`}>{names[i]}</a>
              {block.items.length > 1 && (
                <button type="button" className={s.iconBtn} aria-label={`Remove ${names[i]} from block`} onClick={() => actions.onRemoveItem(item.id)}>
                  ×
                </button>
              )}
            </div>
            <label className={s.step}>
              Progression step ({unit})
              <input
                key={`${item.id}-${actions.stepOf(item.ref)}`}
                className={s.stepInput}
                inputMode="decimal"
                defaultValue={actions.stepOf(item.ref)}
                onBlur={(e) => {
                  const v = Number(e.target.value.replace(",", "."));
                  if (Number.isFinite(v) && v > 0) actions.onStep(item.ref, v);
                  else e.target.value = String(actions.stepOf(item.ref));
                }}
              />
            </label>
            <div className={s.repRow}>
              <Stepper label={`${names[i]} minimum reps`} value={item.repMin} min={1} max={100} onChange={(v) => actions.onReps(item.id, { repMin: v })} />
              <span aria-hidden="true">to</span>
              <Stepper label={`${names[i]} maximum reps`} value={item.repMax} min={1} max={100} onChange={(v) => actions.onReps(item.id, { repMax: v })} />
            </div>
          </li>
        ))}
      </ul>

      {note === "push-pull" && <p className={s.note}>Push/pull pair</p>}
      {note === "same-muscle" && <p className={s.note}>Both target {cap(info(block.items[0].ref)?.primary[0] ?? "the same muscle")}.</p>}

      <div className={s.controls}>
        <Stepper label={block.kind === "single" ? "Sets" : "Rounds"} value={block.sets} min={1} max={30} onChange={actions.onSets} />
        <Stepper label="Rest" value={block.restS} step={15} min={0} max={600} format={mmss} onChange={actions.onRest} />
        {block.items.length > 1 && (
          <Stepper label="Rest between exercises" value={block.transitionRestS} step={5} min={0} max={300} format={mmss} onChange={actions.onTransition} />
        )}
      </div>

      {bank && (
        <div className={s.schedule}>
          <label>
            Schedule
            <select
              value={mode}
              onChange={(e) => {
                const m = e.target.value;
                if (m === "daily") actions.onSchedule({ weekdays: ALL_WEEKDAYS, weeklyTarget: null });
                else if (m === "week") actions.onSchedule({ weekdays: null, weeklyTarget: block.weeklyTarget ?? 2 });
                else actions.onSchedule({ weekdays: block.weekdays?.length && block.weekdays.length < 7 ? block.weekdays : [1, 3, 5], weeklyTarget: null });
              }}
            >
              <option value="daily">Every day</option>
              <option value="week">Times per week</option>
              <option value="days">Specific days</option>
            </select>
          </label>
          {mode === "week" && (
            <Stepper label="Times per week" value={block.weeklyTarget ?? 2} min={1} max={7} onChange={(v) => actions.onSchedule({ weekdays: null, weeklyTarget: v })} />
          )}
          {mode === "days" && (
            <fieldset className={s.dayChips}>
              <legend className={s.visuallyHidden}>Days</legend>
              {ALL_WEEKDAYS.map((d) => {
                const on = block.weekdays?.includes(d) ?? false;
                return (
                  <label key={d} className={s.dayChip}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const cur = block.weekdays ?? [];
                        const next = on ? cur.filter((x) => x !== d) : [...cur, d].sort();
                        if (next.length) actions.onSchedule({ weekdays: next, weeklyTarget: null });
                      }}
                    />
                    <span title={WEEKDAY_NAMES[d]}>{WEEKDAY_NAMES[d].slice(0, 2)}</span>
                  </label>
                );
              })}
            </fieldset>
          )}
        </div>
      )}

      <footer className={s.cardFoot}>
        <label>
          <span className={s.visuallyHidden}>Move {names.join(" and ")} to</span>
          <select
            value=""
            onChange={(e) => e.target.value && actions.onMove(toTarget(e.target.value))}
            aria-label={`Move ${names.join(" and ")} to`}
          >
            <option value="">Move to…</option>
            {ALL_WEEKDAYS.map((d) => (
              <option key={d} value={d} disabled={container === `day:${d}`}>{WEEKDAY_NAMES[d]}</option>
            ))}
            <option value="bank" disabled={container === "bank"}>Accessory bank</option>
          </select>
        </label>
        {block.items.length > 1 && (
          <button type="button" className={s.textBtn} onClick={actions.onUnlink}>Unlink</button>
        )}
      </footer>

      {dragging && !sortable.isDragging && (
        <div ref={join.setNodeRef} className={`${s.join} ${join.isOver ? s.joinOver : ""}`}>
          Drop to superset
        </div>
      )}
    </article>
  );
}
