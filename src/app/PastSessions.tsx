import { useState } from "react";
import { usePastSessionActions, usePastSessions, type PastSession } from "../data/sessions";
import type { Exercise } from "../exercises/types";
import { isCardio, parseTime } from "../session/cardio";
import { summarize } from "../session/summary";
import { mmss } from "../session/timer";
import { fromKg, toKg, type Unit } from "../units";
import { ConfirmSheet } from "./ConfirmSheet";
import { TrashIcon } from "./icons";
import f from "./Form.module.css";
import s from "./Session.module.css";
import d from "./Dashboard.module.css";

function PastItem({ past, unit, info }: { past: PastSession; unit: Unit; info: (ref: string) => Exercise | undefined }) {
  const actions = usePastSessionActions();
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deletingSet, setDeletingSet] = useState<{ id: string; label: string } | null>(null);
  const { session, sets } = past;
  const sum = summarize(sets, (ref) => isCardio(info(ref)));
  const date = new Date(session.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const groups = [...new Set(sets.map((x) => x.exercise_ref))];
  const run = (p: Promise<void>) => p.then(() => setError(""), (e: Error) => setError(e.message));

  return (
    <details className={s.past}>
      <summary>
        <span>{date}</span>
        <span className={s.sub}>{sum.workingSets} sets · {Math.round(fromKg(sum.volumeKg, unit)).toLocaleString()} {unit}</span>
      </summary>
      <button
        type="button" className={`${f.quiet} ${f.danger} ${s.pastDelete}`}
        onClick={() => setConfirming(true)}
      >
        Delete session
      </button>
      {groups.map((ref) => {
        const cardio = isCardio(info(ref));
        return (
        <div key={ref} className={s.pastGroup}>
          <h4 className={s.roundTitle}>{info(ref)?.name ?? ref}</h4>
          <div className={`${s.pastSet} ${s.pastHead}`} aria-hidden="true">
            <span />
            <span>{cardio ? "lvl" : unit}</span>
            <span>{cardio ? "time" : "reps"}</span>
          </div>
          {sets
            .filter((x) => x.exercise_ref === ref)
            .sort((a, b) => a.completed_at.localeCompare(b.completed_at))
            .map((x, i) => {
              const label = x.is_warmup ? "Warm-up" : `Set ${i + 1}`;
              return (
                <div key={x.id} className={s.pastSet}>
                  <span className={s.setLabel}>{label}</span>
                  <label>
                    <span className={s.visuallyHidden}>{label} {cardio ? "level" : `weight (${unit})`}</span>
                    <input
                      className={s.num} inputMode="decimal" defaultValue={cardio ? x.weight_kg : fromKg(x.weight_kg, unit)}
                      onBlur={(e) => {
                        const v = Number(e.target.value.replace(",", "."));
                        const kg = cardio ? v : toKg(v, unit);
                        if (Number.isFinite(v) && v >= 0 && kg !== x.weight_kg) void run(actions.updateSet(x.id, { weight_kg: kg }));
                        else e.target.value = String(cardio ? x.weight_kg : fromKg(x.weight_kg, unit));
                      }}
                    />
                  </label>
                  <label>
                    <span className={s.visuallyHidden}>{label} {cardio ? "time" : "reps"}</span>
                    <input
                      className={s.num} inputMode={cardio ? "text" : "numeric"} defaultValue={cardio ? mmss(x.reps) : x.reps}
                      onBlur={(e) => {
                        const v = cardio ? parseTime(e.target.value) : Number(e.target.value);
                        if (v !== null && Number.isInteger(v) && v >= 1 && v !== x.reps) void run(actions.updateSet(x.id, { reps: v }));
                        else e.target.value = cardio ? mmss(x.reps) : String(x.reps);
                      }}
                    />
                  </label>
                  <button
                    type="button" className={f.iconBtn}
                    aria-label={`Delete ${label.toLowerCase()} of ${info(ref)?.name ?? ref}`}
                    onClick={() => setDeletingSet({ id: x.id, label: `${label} of ${info(ref)?.name ?? ref}` })}
                  >
                    <TrashIcon />
                  </button>
                </div>
              );
            })}
        </div>
        );
      })}
      {error && <p className={f.error} role="alert">{error}</p>}
      <ConfirmSheet
        open={deletingSet !== null}
        title="Delete this set?"
        body={deletingSet ? `${deletingSet.label} from ${date} is removed from your history.` : ""}
        confirmLabel="Delete set"
        destructive
        onClose={() => setDeletingSet(null)}
        onConfirm={() => {
          if (deletingSet) void run(actions.deleteSet(deletingSet.id));
          setDeletingSet(null);
        }}
      />
      <ConfirmSheet
        open={confirming}
        title="Delete this session?"
        body={`The session from ${date} and its sets are removed from your history.`}
        confirmLabel="Delete session"
        destructive
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void run(actions.deleteSession(session.id));
        }}
      />
    </details>
  );
}

export function PastSessions({ unit, info }: { unit: Unit; info: (ref: string) => Exercise | undefined }) {
  const past = usePastSessions();
  if (past.isPending) return null;
  if (past.error) return <p className={f.error} role="alert">Could not load past sessions: {past.error.message}</p>;
  return (
    <section aria-label="Past sessions" className={`${d.section} ${s.pastSection}`}>
      <h2 className={d.h2}>Past sessions</h2>
      <div className={s.pastScroll} data-thumb="">
        {past.data.length === 0 ? (
          <p className={f.note}>Finished sessions appear here, and you can correct any set.</p>
        ) : (
          past.data.map((p) => <PastItem key={p.session.id} past={p} unit={unit} info={info} />)
        )}
      </div>
    </section>
  );
}
