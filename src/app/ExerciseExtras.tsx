import { useMemo, useState } from "react";
import { useDashboardData } from "../data/dashboard";
import type { Profile } from "../data/profile";
import { useRoutineActions, useRoutines } from "../data/routines";
import type { Exercise } from "../exercises/types";
import { RANKING_LIFTS } from "../ranking/standards";
import { e1rmSeries, prEvents } from "../ranking/stats";
import { addBlock, newBlock } from "../routines/model";
import { fromKg } from "../units";
import { WEEKDAY_NAMES } from "./BlockCard";
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
          <span className={f.note}>on {new Date(best.t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
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

/** Puts the exercise on a day of the active routine, or in its accessory bank. */
export function AddToRoutine({ exercise, profile }: { exercise: Exercise; profile: Profile }) {
  const routines = useRoutines();
  const actions = useRoutineActions();
  const [added, setAdded] = useState("");
  const active = (routines.data ?? []).find((r) => r.isActive && !r.archivedAt);

  if (routines.isPending) return null;
  if (!active)
    return (
      <p className={f.note}>
        No active routine. <a href="#/routines">Create one in Routines</a> to add exercises to it.
      </p>
    );
  return (
    <div className={s.addTo}>
      <label>
        <span className={s.addLabel}>Add to {active.name}</span>
        <select
          className={f.input}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const target = v === "bank" ? ("bank" as const) : { day: Number(v) };
            actions.update(active.id, (r) => addBlock(r, target, newBlock(exercise.ref, profile.default_rest_s)));
            setAdded(v === "bank" ? "Added to the accessory bank" : `Added to ${WEEKDAY_NAMES[Number(v)]}`);
          }}
        >
          <option value="">Choose a day</option>
          {WEEKDAY_NAMES.map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
          <option value="bank">Accessory bank</option>
        </select>
      </label>
      <p className={f.note} role="status" style={{ margin: "4px 0 0" }}>{added}</p>
    </div>
  );
}
