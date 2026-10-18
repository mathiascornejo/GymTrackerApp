import { useState } from "react";
import { useStepActions, useSteps } from "../data/steps";
import { movingAverage } from "../ranking/stats";
import { Averages } from "./Averages";
import { LineChart } from "./charts";
import { ConfirmSheet } from "./ConfirmSheet";
import { TrashIcon } from "./icons";
import f from "./Form.module.css";
import s from "./Dashboard.module.css";
import w from "./Weight.module.css";

const fmt = (n: number) => Math.round(n).toLocaleString();

/** Daily steps on their own tab, laid out like the weight tab: averages and trend, a way to log today, and every day with a delete. */
export function Steps() {
  const data = useSteps();
  const actions = useStepActions();
  const [value, setValue] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; date: string; text: string } | null>(null);

  if (data.error) return <p className={f.error} role="alert">Could not load your steps log: {data.error.message}</p>;
  if (data.isPending) return null;

  const entries = data.data;
  const points = entries.map((e) => ({ t: new Date(`${e.logged_on}T12:00:00`).getTime(), v: e.steps }));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(value.replace(/[,\s]/g, ""));
    if (!Number.isInteger(v) || v < 0 || v > 200_000) return;
    actions.addSteps.mutate({ logged_on: new Date().toLocaleDateString("en-CA"), steps: v }, { onSuccess: () => setValue("") });
  };

  return (
    <>
      <div className={w.fit}>
        <section aria-label="Steps trend" className={`${s.section} ${s.wide}`}>
          <h2 className={s.h2}>Trend</h2>
          <Averages points={points} format={(v) => `${fmt(v)} steps`} />
          {entries.length > 0 ? (
            <LineChart points={points} unit="steps" label="Steps" average={points.length >= 3 ? movingAverage(points) : undefined} />
          ) : (
            <p className={f.note}>No steps yet. Add today's total to start the trend.</p>
          )}
          <form onSubmit={add} className={s.inline}>
            <label>
              <span className={s.visuallyHidden}>Add steps for today</span>
              <input className={f.input} inputMode="numeric" placeholder="Today's steps" value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            <button className={f.button} type="submit" disabled={actions.addSteps.isPending}>Add steps</button>
          </form>
          {(actions.addSteps.error || actions.deleteSteps.error) && (
            <p className={f.error} role="alert">{(actions.addSteps.error ?? actions.deleteSteps.error)!.message}</p>
          )}
        </section>

        <section aria-label="Steps log" className={`${s.section} ${w.logCard}`}>
          <h2 className={s.h2}>Log</h2>
          {entries.length === 0 ? (
            <p className={f.note}>Nothing logged yet.</p>
          ) : (
            <ul className={w.list} data-thumb="">
              {[...entries].reverse().map((e) => {
                const date = new Date(`${e.logged_on}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
                return (
                  <li key={e.id}>
                    <span>{date}</span>
                    <span className={w.value}>{fmt(e.steps)} steps</span>
                    <button
                      className={f.iconBtn}
                      aria-label={`Delete steps from ${date}`}
                      disabled={actions.deleteSteps.isPending}
                      onClick={() => setDeleting({ id: e.id, date, text: `${fmt(e.steps)} steps` })}
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
        title="Delete these steps?"
        body={deleting ? `${deleting.text} from ${deleting.date} is removed from your log and trend.` : ""}
        confirmLabel="Delete steps"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteSteps.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </>
  );
}
