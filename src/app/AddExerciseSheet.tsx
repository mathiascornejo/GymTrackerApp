import { useMemo, useState } from "react";
import { cap, search } from "../exercises/query";
import type { Exercise } from "../exercises/types";
import { Sheet } from "./ExerciseSheet";
import f from "./Form.module.css";
import s from "./Session.module.css";

export function AddExerciseSheet({ open, exercises, onAdd, onClose }: { open: boolean; exercises: Exercise[]; onAdd: (ref: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => search(exercises, query).slice(0, 40), [exercises, query]);
  return (
    <Sheet open={open} onClose={onClose} label="Add exercise">
      <div className={s.sheetTop}>
        <h2 className={s.sheetTitle}>Add exercise</h2>
        <button className={f.quiet} onClick={onClose}>Done</button>
      </div>
      <label>
        <span className={s.visuallyHidden}>Search exercises to add</span>
        <input className={f.input} type="search" placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <ul className={s.addList}>
        {shown.map((e) => (
          <li key={e.ref}>
            <button type="button" className={s.addRow} onClick={() => { onAdd(e.ref); onClose(); }}>
              <span>{e.name}</span>
              <span className={s.sub}>{[e.primary[0] && cap(e.primary[0]), e.equipment].filter(Boolean).join(" · ")}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
