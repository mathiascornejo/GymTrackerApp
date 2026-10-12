import { useState, type FormEvent } from "react";
import { useDeleteCustomExercise, useSaveCustomExercise } from "../data/customExercises";
import { cap } from "../exercises/query";
import type { Exercise } from "../exercises/types";
import { ConfirmSheet } from "./ConfirmSheet";
import f from "./Form.module.css";
import s from "./Library.module.css";

type Options = { muscle: string[]; equipment: string[] };

function Chips({ legend, options, value, onChange }: { legend: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className={s.chips}>
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o} className={s.chip}>
          <input type="checkbox" checked={value.includes(o)} onChange={(e) => onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} />
          <span>{cap(o)}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Pick({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      {label}
      <select className={f.input} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not set</option>
        {options.map((o) => (
          <option key={o} value={o}>{cap(o)}</option>
        ))}
      </select>
    </label>
  );
}

export function CustomExerciseForm({ existing, options, onDone }: { existing: Exercise | null; options: Options; onDone: () => void }) {
  const save = useSaveCustomExercise();
  const del = useDeleteCustomExercise();
  const [name, setName] = useState(existing?.name ?? "");
  const [primary, setPrimary] = useState(existing?.primary ?? []);
  const [secondary, setSecondary] = useState(existing?.secondary ?? []);
  const [equipment, setEquipment] = useState(existing?.equipment ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [steps, setSteps] = useState(existing?.instructions.join("\n") ?? "");
  const error = save.error ?? del.error;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: existing ? existing.ref.replace("custom:", "") : crypto.randomUUID(),
        name: name.trim(),
        primary_muscles: primary,
        secondary_muscles: secondary.filter((m) => !primary.includes(m)),
        equipment: equipment || null,
        // No longer editable or searchable; an existing exercise keeps what it had.
        force: existing?.force ?? null,
        mechanic: existing?.mechanic ?? null,
        level: existing?.level ?? null,
        instructions: steps.split("\n").map((l) => l.trim()).filter(Boolean),
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={submit} className={s.form}>
      <label>
        Name
        <input className={f.input} required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <Chips legend="Primary muscles" options={options.muscle} value={primary} onChange={setPrimary} />
      <Chips legend="Secondary muscles" options={options.muscle} value={secondary} onChange={setSecondary} />
      <Pick label="Equipment" options={options.equipment} value={equipment} onChange={setEquipment} />
      <label>
        Steps (one per line)
        <textarea className={f.input} rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} style={{ padding: 12, textAlign: "left" }} />
      </label>
      {error && <p className={f.error} role="alert">{error.message}</p>}
      <div className={s.actions}>
        <button className={f.button} type="submit" disabled={save.isPending || !name.trim()}>
          {existing ? "Save exercise" : "Create exercise"}
        </button>
        <button type="button" className={f.quiet} onClick={onDone}>Cancel</button>
        {existing && (
          <button
            type="button"
            className={f.quiet}
            disabled={del.isPending}
            onClick={() => setConfirmDelete(true)}
          >
            Delete exercise
          </button>
        )}
      </div>
      {existing && (
        <ConfirmSheet
          open={confirmDelete}
          title={`Delete ${existing.name}?`}
          body="Past sessions keep their logged sets."
          confirmLabel="Delete exercise"
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            del.mutate(existing.ref.replace("custom:", ""), { onSuccess: onDone });
          }}
        />
      )}
    </form>
  );
}
