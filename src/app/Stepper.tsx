import s from "./Routines.module.css";

export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  format = String,
  caption,
}: {
  label: string;
  /** Short visible name shown above the control; the full label stays the accessible name. */
  caption?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  const control = (
    <div className={s.stepper} role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => set(value - step)}>
        −
      </button>
      <output aria-label={label}>{format(value)}</output>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => set(value + step)}>
        +
      </button>
    </div>
  );
  if (!caption) return control;
  return (
    <div className={s.stepField}>
      <span className={s.stepCaption} aria-hidden="true">{caption}</span>
      {control}
    </div>
  );
}
