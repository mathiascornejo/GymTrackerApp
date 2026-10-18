import { useState } from "react";
import { useDashboardActions, useDashboardData } from "../data/dashboard";
import type { Profile } from "../data/profile";
import { movingAverage } from "../ranking/stats";
import { fromKg, toKg } from "../units";
import { Averages } from "./Averages";
import { LineChart } from "./charts";
import { ConfirmSheet } from "./ConfirmSheet";
import { TrashIcon } from "./icons";
import f from "./Form.module.css";
import s from "./Dashboard.module.css";
import w from "./Weight.module.css";

/** Bodyweight on its own tab: the trend, a way to add today's weight, and every entry with a delete. */
export function Weight({ profile }: { profile: Profile }) {
  const data = useDashboardData();
  const actions = useDashboardActions();
  const [value, setValue] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; date: string; text: string } | null>(null);
  const unit = profile.weight_unit;

  if (data.error) return <p className={f.error} role="alert">Could not load your weight log: {data.error.message}</p>;
  if (data.isPending) return null;

  const entries = data.data.bodyweights;
  const points = entries.map((b) => ({ t: new Date(`${b.measured_on}T12:00:00`).getTime(), v: fromKg(b.weight_kg, unit) }));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(value.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    actions.addBodyweight.mutate({ measured_on: new Date().toLocaleDateString("en-CA"), weight_kg: toKg(v, unit) } as never, {
      onSuccess: () => setValue(""),
    });
  };

  return (
    <>
      <div className={w.fit}>
        <section aria-label="Bodyweight trend" className={`${s.section} ${s.wide}`}>
          <h2 className={s.h2}>Trend</h2>
          <Averages points={points} format={(v) => `${Math.round(v * 10) / 10} ${unit}`} />
          {entries.length > 0 ? (
            <LineChart points={points} unit={unit} label="Bodyweight" average={points.length >= 3 ? movingAverage(points) : undefined} />
          ) : (
            <p className={f.note}>No weights yet. Add one to start the trend.</p>
          )}
          <form onSubmit={add} className={s.inline}>
            <label>
              <span className={s.visuallyHidden}>Add bodyweight ({unit})</span>
              <input className={f.input} inputMode="decimal" placeholder="Today's weight" value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            <button className={f.button} type="submit" disabled={actions.addBodyweight.isPending}>Add weight</button>
          </form>
          {(actions.addBodyweight.error || actions.deleteBodyweight.error) && (
            <p className={f.error} role="alert">{(actions.addBodyweight.error ?? actions.deleteBodyweight.error)!.message}</p>
          )}
        </section>

        <section aria-label="Weight log" className={`${s.section} ${w.logCard}`}>
          <h2 className={s.h2}>Log</h2>
          {entries.length === 0 ? (
            <p className={f.note}>Nothing logged yet.</p>
          ) : (
            <ul className={w.list} data-thumb="">
              {[...entries].reverse().map((b) => {
                const date = new Date(`${b.measured_on}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
                return (
                  <li key={b.id}>
                    <span>{date}</span>
                    <span className={w.value}>{fromKg(b.weight_kg, unit)} {unit}</span>
                    <button
                      className={f.iconBtn}
                      aria-label={`Delete weight from ${date}`}
                      disabled={actions.deleteBodyweight.isPending}
                      onClick={() => setDeleting({ id: b.id, date, text: `${fromKg(b.weight_kg, unit)} ${unit}` })}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <ConfirmSheet
        open={deleting !== null}
        title="Delete this weight?"
        body={deleting ? `${deleting.text} from ${deleting.date} is removed from your log and trend.` : ""}
        confirmLabel="Delete weight"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteBodyweight.mutate(deleting.id as never);
          setDeleting(null);
        }}
      />
    </>
  );
}
