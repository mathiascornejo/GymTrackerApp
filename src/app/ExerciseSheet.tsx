import { type ReactNode } from "react";
import { ExpandableScreen, ExpandableScreenContent } from "./ExpandableScreen";
import { cap } from "../exercises/query";
import type { Exercise } from "../exercises/types";
import type { Profile } from "../data/profile";
import { MuscleMap } from "./BodyMap";
import { ExerciseDemo } from "./ExerciseDemo";
import { AddToRoutine, ExerciseHistory } from "./ExerciseExtras";
import f from "./Form.module.css";
import s from "./Library.module.css";

/** Every popup in the app: an ExpandableScreen that grows out of the control that opened it. Callers keep their own Close or Done button. */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  return (
    <ExpandableScreen expanded={open} onExpandChange={(v) => !v && onClose()} layoutId={`sheet-${label}`}>
      <ExpandableScreenContent label={label} showCloseButton={false}>{children}</ExpandableScreenContent>
    </ExpandableScreen>
  );
}

export function ExerciseDetail({ exercise, profile, onEdit, onClose }: { exercise: Exercise; profile: Profile; onEdit: () => void; onClose: () => void }) {
  const meta = [exercise.equipment, exercise.category].filter(Boolean);
  return (
    <>
      <div className={s.sheetHead}>
        <h2 className={s.sheetTitle}>{exercise.name}</h2>
        <button className={f.quiet} onClick={onClose}>Close</button>
      </div>
      <ExerciseDemo exercise={exercise} />
      <h3 className={f.groupTitle}>Muscles</h3>
      <MuscleMap primary={exercise.primary} secondary={exercise.secondary} />
      <div className={s.muscles} style={{ marginTop: 8 }}>
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
      <h3 className={f.groupTitle}>Your history</h3>
      <ExerciseHistory exercise={exercise} profile={profile} />
      <h3 className={f.groupTitle}>Routine</h3>
      <AddToRoutine exercise={exercise} profile={profile} />
      {exercise.custom && (
        <div className={s.actions}>
          <button className={f.button} onClick={onEdit}>Edit exercise</button>
        </div>
      )}
    </>
  );
}
