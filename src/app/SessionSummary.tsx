import { useDashboardData } from "../data/dashboard";
import type { Profile } from "../data/profile";
import type { SessionRow, SetRow } from "../data/sessions";
import { computeRanks, tierChanges } from "../ranking/rank";
import type { Exercise } from "../exercises/types";
import { cap } from "../exercises/query";
import { findPRs, summarize } from "../session/summary";
import { fromKg, type Unit } from "../units";
import f from "./Form.module.css";
import s from "./Session.module.css";

export type SummaryData = { session: SessionRow; sets: SetRow[]; prior: SetRow[]; unit: Unit };

export function SessionSummary({ data, info, profile, onDone }: { data: SummaryData; info: (ref: string) => Exercise | undefined; profile: Profile; onDone: () => void }) {
  const { session, sets, prior, unit } = data;
  const sum = summarize(sets);
  const prs = findPRs(sets, prior);
  const minutes = Math.max(1, Math.round((new Date(session.ended_at ?? Date.now()).getTime() - new Date(session.started_at).getTime()) / 60000));
  const exercises = [...new Set(sets.filter((x) => !x.is_warmup).map((x) => x.exercise_ref))];

  // Rank changes: tiers with this session's sets removed versus included.
  const dash = useDashboardData();
  const changes = (() => {
    if (!dash.data || !profile.standards_table || !dash.data.bodyweights.length) return null;
    const table = profile.standards_table;
    const ov = profile.standards_overrides ?? {};
    const after = computeRanks(dash.data.sets, dash.data.bodyweights, table, ov, info);
    const before = computeRanks(dash.data.sets.filter((x) => x.session_id !== session.id), dash.data.bodyweights, table, ov, info);
    return tierChanges(before, after);
  })();

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
      {changes && changes.length > 0 && (
        <>
          <h3 className={f.groupTitle}>Rank ups</h3>
          <ul className={s.prList}>
            {changes.map((c) => (
              <li key={c.muscle}>
                <span>{cap(c.muscle)}</span>
                <span>{c.from} to {c.to}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className={f.note}>Estimated 1RM by the Epley formula, from working sets of 1 to 12 reps.</p>
      <button className={f.button} onClick={onDone}>Done</button>
    </div>
  );
}
