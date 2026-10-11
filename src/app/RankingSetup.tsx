import { useState, type FormEvent } from "react";
import { useCompleteRankingSetup, type Profile } from "../data/profile";
import type { Unit } from "../units";
import f from "./Form.module.css";

export function RankingSetup({ profile, onSkip }: { profile: Profile; onSkip?: () => void }) {
  const [unit, setUnit] = useState<Unit>(profile.weight_unit);
  const [standards, setStandards] = useState<"male" | "female">(profile.standards_table ?? "male");
  const [weight, setWeight] = useState("");
  const save = useCompleteRankingSetup();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ unit, standards, weight: Number(weight) });
  };

  return (
    <form onSubmit={submit} className={f.group}>
      <div className={f.stack}>
        <label>
          Weight unit
          <select className={f.input} value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            <option value="kg">Kilograms</option>
            <option value="lb">Pounds</option>
          </select>
        </label>
        <label>
          Current bodyweight ({unit})
          <input className={f.input} inputMode="decimal" required pattern="[0-9]+([.,][0-9]+)?" value={weight} onChange={(e) => setWeight(e.target.value.replace(",", "."))} />
        </label>
        <label>
          Strength standards table
          <select className={f.input} value={standards} onChange={(e) => setStandards(e.target.value as "male" | "female")}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        {save.error && <p className={f.error} role="alert">{save.error.message}</p>}
        <button className={f.button} type="submit" disabled={save.isPending}>Save ranking setup</button>
        {onSkip && <button type="button" className={f.quiet} onClick={onSkip}>Skip for now</button>}
        <p className={f.note}>Ranks need your bodyweight and a standards table. You can log sessions without them.</p>
      </div>
    </form>
  );
}
