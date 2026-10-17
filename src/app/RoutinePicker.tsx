import { useDraggable } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { applyFilters, cap, search } from "../exercises/query";
import type { Exercise } from "../exercises/types";
import type { Target } from "../routines/model";
import { MoreMenu } from "./MoreMenu";
import f from "./Form.module.css";
import s from "./Routines.module.css";

const LIMIT = 40;

export type Place = { target: Target; label: string };

function PickRow({ exercise, onAdd, current, places, draggable, onSaid }: { exercise: Exercise; onAdd: (t: Target) => void; current: Place; places: Place[]; draggable: boolean; onSaid: (text: string) => void }) {
  const [added, setAdded] = useState(false);
  const [addedTo, setAddedTo] = useState<string | null>(null);
  const drag = useDraggable({ id: `pick:${exercise.ref}`, data: { type: "pick", ref: exercise.ref }, disabled: !draggable });
  return (
    <li className={s.pickRow} style={{ opacity: drag.isDragging ? 0.5 : 1 }}>
      <div ref={drag.setNodeRef} className={`${s.pickName} ${draggable ? s.pickDraggable : ""}`} {...drag.attributes} {...drag.listeners}>
        <span>{exercise.name}</span>
        <span className={`${s.sub} ${addedTo ? s.pickAddedTo : ""}`}>
          {addedTo ? `Added to ${addedTo}` : [exercise.primary[0] && cap(exercise.primary[0]), exercise.equipment].filter(Boolean).join(" · ")}
        </span>
      </div>
      <button
        type="button"
        className={`${s.pickAdd} ${added ? s.pickAdded : ""}`}
        aria-label={`Add ${exercise.name} to ${current.label}`}
        onClick={() => {
          onAdd(current.target);
          setAdded(true);
          setTimeout(() => setAdded(false), 1200);
        }}
      >
        {added ? "Added" : "Add"}
      </button>
      <MoreMenu
        label={`Add ${exercise.name} to another day`}
        className={s.pickMore}
        trigger={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {[5, 12, 19].map((y) => <circle key={y} cx="12" cy={y} r="1.8" />)}
          </svg>
        }
        items={places.map((p) => ({
          label: p.label,
          onSelect: () => {
            onAdd(p.target);
            setAddedTo(p.label);
            onSaid(`Added ${exercise.name} to ${p.label}`);
            setTimeout(() => setAddedTo(null), 2000);
          },
        }))}
      />
    </li>
  );
}

export function RoutinePicker({
  exercises, muscles, onAdd, current, places, draggable,
}: {
  exercises: Exercise[];
  muscles: string[];
  onAdd: (ref: string, t: Target) => void;
  /** The day being viewed: the one-tap Add button puts the exercise here. */
  current: Place;
  /** Every place an exercise can go, for the "Add to another day" menu. */
  places: Place[];
  /** Rows can be dragged onto the board. Off on phone, where the picker is a modal sheet and the drop target is hidden. */
  draggable: boolean;
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [said, setSaid] = useState("");
  const shown = useMemo(() => search(applyFilters(exercises, { muscle: muscle || undefined }), query), [exercises, query, muscle]);
  return (
    <section aria-label="Exercise picker" className={s.picker}>
      <p className={f.note}>Adding to {current.label}.</p>
      <p className={s.visuallyHidden} role="status">{said}</p>
      <div className={s.pickerControls}>
        <label className={s.grow}>
          <span className={s.visuallyHidden}>Search the picker</span>
          <input className={f.input} type="search" placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          <span className={s.visuallyHidden}>Muscle</span>
          <select className={f.input} value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            <option value="">Any muscle</option>
            {muscles.map((m) => (
              <option key={m} value={m}>{cap(m)}</option>
            ))}
          </select>
        </label>
      </div>
      <ul className={s.pickList}>
        {shown.slice(0, LIMIT).map((e) => (
          <PickRow key={e.ref} onSaid={setSaid} exercise={e} current={current} places={places} draggable={draggable} onAdd={(t) => onAdd(e.ref, t)} />
        ))}
      </ul>
      {shown.length > LIMIT && <p className={f.note}>Showing {LIMIT} of {shown.length}. Search to narrow the list.</p>}
      {shown.length === 0 && <p className={f.note}>No exercises match.</p>}
    </section>
  );
}
