import { useDraggable } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { applyFilters, cap, facets, search } from "../exercises/query";
import type { Exercise } from "../exercises/types";
import type { Target } from "../routines/model";
import f from "./Form.module.css";
import s from "./Routines.module.css";

const LIMIT = 40;

function PickRow({ exercise, onAdd, current }: { exercise: Exercise; onAdd: (t: Target) => void; current: { target: Target; label: string } }) {
  const [added, setAdded] = useState(false);
  const drag = useDraggable({ id: `pick:${exercise.ref}`, data: { type: "pick", ref: exercise.ref } });
  return (
    <li className={s.pickRow} style={{ opacity: drag.isDragging ? 0.5 : 1 }}>
      <div ref={drag.setNodeRef} className={s.pickName} {...drag.attributes} {...drag.listeners}>
        <span>{exercise.name}</span>
        <span className={s.sub}>{[exercise.primary[0] && cap(exercise.primary[0]), exercise.equipment].filter(Boolean).join(" · ")}</span>
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
    </li>
  );
}

export function RoutinePicker({
  exercises, muscles, onAdd, current,
}: {
  exercises: Exercise[];
  muscles: string[];
  onAdd: (ref: string, t: Target) => void;
  /** The day being viewed: the one-tap Add button puts the exercise here. */
  current: { target: Target; label: string };
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const equipmentOptions = useMemo(() => facets(exercises).equipment, [exercises]);
  const shown = useMemo(
    () => search(applyFilters(exercises, { muscle: muscle || undefined, equipment: equipment || undefined }), query),
    [exercises, query, muscle, equipment],
  );
  return (
    <section aria-label="Exercise picker" className={s.picker}>
      <p className={f.note}>Adding to {current.label}.</p>
      <div className={s.pickerControls}>
        <label className={s.grow}>
          <span className={s.visuallyHidden}>Search the picker</span>
          <input className={f.input} type="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
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
        <label>
          <span className={s.visuallyHidden}>Equipment</span>
          <select className={f.input} value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            <option value="">Any equipment</option>
            {equipmentOptions.map((o) => (
              <option key={o} value={o}>{cap(o)}</option>
            ))}
          </select>
        </label>
      </div>
      <ul className={s.pickList} data-thumb="">
        {shown.slice(0, LIMIT).map((e) => (
          <PickRow key={e.ref} exercise={e} current={current} onAdd={(t) => onAdd(e.ref, t)} />
        ))}
      </ul>
      {shown.length > LIMIT && <p className={f.note}>Showing {LIMIT} of {shown.length}. Search to narrow the list.</p>}
      {shown.length === 0 && <p className={f.note}>No exercises match.</p>}
    </section>
  );
}
