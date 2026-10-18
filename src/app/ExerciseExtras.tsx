import { useMemo } from "react";
import { useDashboardData } from "../data/dashboard";
import type { Profile } from "../data/profile";
import type { Exercise } from "../exercises/types";
import { RANKING_LIFTS } from "../ranking/standards";
import { e1rmSeries, prEvents } from "../ranking/stats";
import { fromKg } from "../units";
import { LineChart } from "./charts";
import f from "./Form.module.css";
import s from "./Library.module.css";

/** Best estimated 1RM, a small trend and recent records for one exercise, from the user's own sets. */
export function ExerciseHistory({ exercise, profile }: { exercise: Exercise; profile: Profile }) {
  const dash = useDashboardData();
  const unit = profile.weight_unit;
  const view = useMemo(() => {
    if (!dash.data) return null;
    const sets = dash.data.sets.filter((x) => x.exercise_ref === exercise.ref);
    const load = RANKING_LIFTS.find((l) => l.ref === exercise.ref)?.load ?? "external";
    const series = e1rmSeries(sets, exercise.ref, load, dash.data.bodyweights, null);
    return { sets: sets.length, series, prs: prEvents(sets).slice(-5).reverse() };
  }, [dash.data, exercise.ref]);

  if (dash.error) return <p className={f.note}>History could not be loaded: {dash.error.message}</p>;
  if (!view) return <p className={f.note}>Loading your history.</p>;
  if (view.sets === 0) return <p className={f.note}>No history yet. Log this exercise and its best and trend appear here.</p>;
  const best = view.series.reduce((m, p) => (p.e1rmKg > m.e1rmKg ? p : m), view.series[0]);
  return (
    <div>
      {best && (
        <p style={{ margin: "0 0 8px" }}>
          Best estimated 1RM: <strong>{fromKg(best.e1rmKg, unit)} {unit}</strong>{" "}
          <span className={f.note} style={{ whiteSpace: "nowrap" }}>on {new Date(best.t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        </p>
      )}
      {view.series.length > 1 && (
        <LineChart points={view.series.map((p) => ({ t: p.t, v: fromKg(p.e1rmKg, unit) }))} unit={unit} label={`${exercise.name} estimated 1RM`} />
      )}
      {view.prs.length > 0 && (
        <ul className={s.prs}>
          {view.prs.map((p) => (
            <li key={p.at}>
              <span>{new Date(p.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              <span>{fromKg(p.e1rmKg, unit)} {unit}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
