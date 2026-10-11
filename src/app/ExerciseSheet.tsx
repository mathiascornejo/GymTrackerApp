import { useEffect, useRef, type ReactNode } from "react";
import { cap } from "../exercises/query";
import type { Exercise } from "../exercises/types";
import { ExerciseDemo } from "./ExerciseDemo";
import f from "./Form.module.css";
import s from "./Library.module.css";

/** A modal <dialog> styled as a bottom sheet (centered panel on desktop). The browser supplies focus trapping and Escape. */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={s.sheet} aria-label={label} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && <div className={s.sheetBody}>{children}</div>}
    </dialog>
  );
}

export function ExerciseDetail({ exercise, onEdit, onClose }: { exercise: Exercise; onEdit: () => void; onClose: () => void }) {
  const meta = [exercise.equipment, exercise.level, exercise.force, exercise.mechanic, exercise.category].filter(Boolean);
  return (
    <>
      <div className={s.sheetHead}>
        <h2 className={s.sheetTitle}>{exercise.name}</h2>
        <button className={f.quiet} onClick={onClose}>Close</button>
      </div>
      <ExerciseDemo exercise={exercise} />
      <h3 className={f.groupTitle}>Muscles</h3>
      <div className={s.muscles}>
        {exercise.primary.map((m) => (
          <span key={m} className={s.musclePrimary}>{cap(m)}</span>
        ))}
        {exercise.secondary.map((m) => (
          <span key={m} className={s.muscleSecondary}>{cap(m)}</span>
        ))}
        {!exercise.primary.length && !exercise.secondary.length && <span className={f.note}>No muscles set.</span>}
      </div>
      {meta.length > 0 && <p className={f.note} style={{ marginTop: 12 }}>{meta.map((m) => cap(m as string)).join(" · ")}</p>}
      <h3 className={f.groupTitle}>How to perform</h3>
      {exercise.instructions.length ? (
        <ol className={s.steps}>
          {exercise.instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      ) : (
        <p className={f.note}>No steps added.</p>
      )}
      {exercise.custom && (
        <div className={s.actions}>
          <button className={f.button} onClick={onEdit}>Edit exercise</button>
        </div>
      )}
    </>
  );
}
