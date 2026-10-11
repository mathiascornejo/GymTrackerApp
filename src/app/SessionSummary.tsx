import type { SessionRow, SetRow } from "../data/sessions";
import type { Exercise } from "../exercises/types";
import { findPRs, summarize } from "../session/summary";
import { fromKg, type Unit } from "../units";
import f from "./Form.module.css";
import s from "./Session.module.css";

export type SummaryData = { session: SessionRow; sets: SetRow[]; prior: SetRow[]; unit: Unit };

export function SessionSummary({ data, info, onDone }: { data: SummaryData; info: (ref: string) => Exercise | undefined; onDone: () => void }) {
  const { session, sets, prior, unit } = data;
  const sum = summarize(sets);
  const prs = findPRs(sets, prior);
  const minutes = Math.max(1, Math.round((new Date(session.ended_at ?? Date.now()).getTime() - new Date(session.started_at).getTime()) / 60000));
  const exercises = [...new Set(sets.filter((x) => !x.is_warmup).map((x) => x.exercise_ref))];

  return (
    <div className={s.summary}>
      <h2 className={s.logTitle}>Session saved</h2>
      <dl className={s.stats}>
        <div><dt>Duration</dt><dd>{minutes} min</dd></div>
        <div><dt>Working sets</dt><dd>{sum.workingSets}</dd></div>
        <div><dt>Volume</dt><dd>{Math.round(fromKg(sum.volumeKg, unit)).toLocaleString()} {unit}</dd></div>
        <div><dt>Exercises</dt><dd>{exercises.length}</dd></div>
      </dl>

      <h3 className={f.groupTitle}>Personal bests</h3>
      {prs.length === 0 ? (
        <p className={f.note}>No new estimated 1RM bests this session.</p>
      ) : (
        <ul className={s.prList}>
          {prs.map((p) => (
            <li key={p.ref}>
              <span>{info(p.ref)?.name ?? p.ref}</span>
              <span>
                {fromKg(p.e1rmKg, unit)} {unit} <span className={s.sub}>from {fromKg(p.previousKg, unit)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className={f.note}>Estimated 1RM by the Epley formula, from working sets of 1 to 12 reps.</p>
      <button className={f.button} onClick={onDone}>Done</button>
    </div>
  );
}
