import { useState } from "react";
import { usePastSessionActions, usePastSessions, type PastSession } from "../data/sessions";
import type { Exercise } from "../exercises/types";
import { summarize } from "../session/summary";
import { fromKg, toKg, type Unit } from "../units";
import f from "./Form.module.css";
import s from "./Session.module.css";

function PastItem({ past, unit, info }: { past: PastSession; unit: Unit; info: (ref: string) => Exercise | undefined }) {
  const actions = usePastSessionActions();
  const [error, setError] = useState("");
  const { session, sets } = past;
  const sum = summarize(sets);
  const date = new Date(session.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const groups = [...new Set(sets.map((x) => x.exercise_ref))];
  const run = (p: Promise<void>) => p.then(() => setError(""), (e: Error) => setError(e.message));

  return (
    <details className={s.past}>
      <summary>
        <span>{date}</span>
        <span className={s.sub}>{sum.workingSets} sets · {Math.round(fromKg(sum.volumeKg, unit)).toLocaleString()} {unit}</span>
      </summary>
      {groups.map((ref) => (
        <div key={ref} className={s.pastGroup}>
          <h4 className={s.roundTitle}>{info(ref)?.name ?? ref}</h4>
          {sets
            .filter((x) => x.exercise_ref === ref)
            .sort((a, b) => a.completed_at.localeCompare(b.completed_at))
            .map((x, i) => (
              <div key={x.id} className={s.pastSet}>
                <span className={s.setLabel}>{x.is_warmup ? "Warm-up" : `Set ${i + 1}`}</span>
                <label>
                  <span className={s.visuallyHidden}>Weight ({unit})</span>
                  <input
                    className={s.num} inputMode="decimal" defaultValue={fromKg(x.weight_kg, unit)}
                    onBlur={(e) => {
                      const v = Number(e.target.value.replace(",", "."));
                      if (Number.isFinite(v) && v >= 0 && toKg(v, unit) !== x.weight_kg) void run(actions.updateSet(x.id, { weight_kg: toKg(v, unit) }));
                      else e.target.value = String(fromKg(x.weight_kg, unit));
                    }}
                  />
                </label>
                <label>
                  <span className={s.visuallyHidden}>Reps</span>
                  <input
                    className={s.num} inputMode="numeric" defaultValue={x.reps}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isInteger(v) && v >= 1 && v !== x.reps) void run(actions.updateSet(x.id, { reps: v }));
                      else e.target.value = String(x.reps);
                    }}
                  />
                </label>
                <button type="button" className={f.quiet} onClick={() => void run(actions.deleteSet(x.id))} aria-label={`Delete set ${i + 1} of ${info(ref)?.name ?? ref}`}>
                  Delete
                </button>
              </div>
            ))}
        </div>
      ))}
      {error && <p className={f.error} role="alert">{error}</p>}
      <button
        type="button" className={f.quiet}
        onClick={() => window.confirm(`Delete the session from ${date}? Its sets are removed from your history.`) && void run(actions.deleteSession(session.id))}
      >
        Delete session
      </button>
    </details>
  );
}

export function PastSessions({ unit, info }: { unit: Unit; info: (ref: string) => Exercise | undefined }) {
  const past = usePastSessions();
  if (past.isPending) return null;
  if (past.error) return <p className={f.error} role="alert">Could not load past sessions: {past.error.message}</p>;
  return (
    <section aria-label="Past sessions">
      <h2 className={f.groupTitle}>Past sessions</h2>
      {past.data.length === 0 ? (
        <p className={f.note}>Finished sessions appear here, and you can correct any set.</p>
      ) : (
        past.data.map((p) => <PastItem key={p.session.id} past={p} unit={unit} info={info} />)
      )}
    </section>
  );
}
