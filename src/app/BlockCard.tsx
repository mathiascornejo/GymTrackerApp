import { useState } from "react";
import { isCardio } from "../session/cardio";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Exercise } from "../exercises/types";
import { cap } from "../exercises/query";
import { ALL_WEEKDAYS, pairNote, type Block } from "../routines/model";
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
  /** Opens the exercise popup in place; the tab does not change. */
  onView: (ref: string) => void;
  onUnlink: () => void;
  onSchedule: (patch: { weekdays: number[] | null; weeklyTarget: number | null }) => void;
  /** Progression step for an exercise, in the display unit, and how to change it (given in the display unit). */
  stepOf: (ref: string) => number;
  onStep: (ref: string, value: number) => void;
};

export function BlockCard({
  block, bank, position, selecting, selected, onToggle, info, actions, unit,
}: {
  block: Block;
  bank: boolean;
  /** 1-based order within the day; absent in the bank, where order means nothing. */
  position?: number;
  /** Selection mode (to link cards into a superset): the grip gives way to a checkbox. */
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  info: (ref: string) => Exercise | undefined;
  actions: BlockActions;
  unit: string;
}) {
  const [open, setOpen] = useState(false);
  const sortable = useSortable({ id: block.id, data: { type: "block", id: block.id }, disabled: selecting });
  const names = block.items.map((i) => info(i.ref)?.name ?? i.ref.replace(/^\w+:/, ""));
  const note = pairNote(block, (ref) => {
    const e = info(ref);
    return e && { force: e.force, primary: e.primary };
  });
  const mode = block.weeklyTarget !== null && block.weekdays === null ? "week" : block.weekdays?.length === 7 ? "daily" : "days";

  const label = names.join(" and ");
  // "Chest, Triceps · Barbell" per exercise; a superset joins its exercises with a slash.
  const meta = block.items
    .map((i) => {
      const e = info(i.ref);
      if (!e) return "";
      const muscles = [...e.primary, ...e.secondary.slice(0, 2)].map(cap).join(", ");
      return [muscles, e.equipment && cap(e.equipment)].filter(Boolean).join(" · ");
    })
    .filter(Boolean)
    .join(" / ");
  const multi = block.items.length > 1;

  return (
    <article
      ref={sortable.setNodeRef}
      className={`${s.card} ${open ? "" : s.compact} ${sortable.isDragging ? s.cardDragging : ""}`}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      aria-label={label}
      // Tapping the card body opens the editor; the Edit button stays for keyboard users.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button,select,input,label")) return;
        if (selecting) onToggle();
        else if (!open) setOpen(true);
      }}
    >
      {!open && meta && <p className={`${s.note} ${s.cardMeta} ${position ? s.hasPos : ""}`}>{meta}</p>}

      <div className={s.cardTop}>
        {selecting ? (
          <label className={s.select}>
            <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${label}`} />
          </label>
        ) : (
          <button type="button" className={s.grip} aria-label={`Reorder ${label}`} {...sortable.attributes} {...sortable.listeners}>
            <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true">
              {[3, 10, 17].flatMap((y) => [3, 11].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
            </svg>
          </button>
        )}

        <div className={s.cardMain}>
          <ul className={s.items}>
            {block.items.map((item, i) => (
              <li key={item.id} className={s.itemName}>
                {position && <span className={s.pos} aria-hidden="true">{position}{multi ? String.fromCharCode(97 + i) : ""}</span>}
                <button type="button" className={s.itemLink} onClick={() => actions.onView(item.ref)}>{names[i]}</button>
                {!open && !isCardio(info(item.ref)) && <span className={s.itemMeta}>{item.repMin}–{item.repMax}</span>}
                {open && multi && (
                  <button type="button" className={s.iconBtn} aria-label={`Remove ${names[i]} from block`} onClick={() => actions.onRemoveItem(item.id)}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {!selecting && <button
          type="button" className={s.editBtn} aria-expanded={open}
          aria-label={`${open ? "Close editor for" : "Edit"} ${label}`} onClick={() => setOpen(!open)}
        >
          {open ? "Done" : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          )}
        </button>}
      </div>

      {!open && (
        <p className={`${s.note} ${s.cardNote} ${position ? s.hasPos : ""}`}>
          {multi ? `${block.sets} rounds` : `${block.sets} sets`} · rest {mmss(block.restS)}
          {bank && block.weeklyTarget !== null && block.weekdays === null ? ` · ${block.weeklyTarget} a week` : ""}
          {bank && block.weekdays && block.weekdays.length < 7 ? ` · ${block.weekdays.map((d) => WEEKDAY_NAMES[d].slice(0, 3)).join(", ")}` : ""}
          {bank && block.weekdays?.length === 7 ? " · every day" : ""}
        </p>
      )}

      {open && !selecting && (
        <>
          {block.items.map((item, i) => (
            <div key={item.id} className={s.itemEdit}>
              {multi && <p className={s.itemEditName}>{names[i]}</p>}
              {!isCardio(info(item.ref)) && <div className={s.repRow}>
                <Stepper caption="Min reps" label={`${names[i]} minimum reps`} value={item.repMin} min={1} max={100} onChange={(v) => actions.onReps(item.id, { repMin: v })} />
                <Stepper caption="Max reps" label={`${names[i]} maximum reps`} value={item.repMax} min={1} max={100} onChange={(v) => actions.onReps(item.id, { repMax: v })} />
                <label className={s.step}>
                  <span>Step ({unit})</span>
                  <input
                    key={`${item.id}-${actions.stepOf(item.ref)}`}
                    className={s.stepInput}
                    inputMode="decimal"
                    aria-label={`Progression step (${unit})${multi ? ` for ${names[i]}` : ""}`}
                    defaultValue={actions.stepOf(item.ref)}
                    onBlur={(e) => {
                      const v = Number(e.target.value.replace(",", "."));
                      if (Number.isFinite(v) && v > 0) actions.onStep(item.ref, v);
                      else e.target.value = String(actions.stepOf(item.ref));
                    }}
                  />
                </label>
              </div>}
            </div>
          ))}

          {note === "push-pull" && <p className={s.note}>Push/pull pair</p>}
          {note === "same-muscle" && <p className={s.note}>Both target {cap(info(block.items[0].ref)?.primary[0] ?? "the same muscle")}.</p>}

          <div className={s.controls}>
            <Stepper caption={multi ? "Rounds" : "Sets"} label={multi ? "Rounds" : "Sets"} value={block.sets} min={1} max={30} onChange={actions.onSets} />
            <Stepper caption="Rest" label="Rest" value={block.restS} step={15} min={0} max={600} format={mmss} onChange={actions.onRest} />
            {multi && (
              <Stepper caption="Between exercises" label="Rest between exercises" value={block.transitionRestS} step={5} min={0} max={300} format={mmss} onChange={actions.onTransition} />
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
                <Stepper caption="Times per week" label="Times per week" value={block.weeklyTarget ?? 2} min={1} max={7} onChange={(v) => actions.onSchedule({ weekdays: null, weeklyTarget: v })} />
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
            {multi ? <button type="button" className={s.textBtn} onClick={actions.onUnlink}>Unlink</button> : <span />}
            <button type="button" className={`${s.textBtn} ${s.textDanger}`} aria-label={`Remove ${label}`} onClick={actions.onRemoveBlock}>
              Remove
            </button>
          </footer>
        </>
      )}
    </article>
  );
}
