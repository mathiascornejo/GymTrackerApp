import { useEffect, useMemo, useState } from "react";
import { useDashboardActions, useDashboardData } from "../data/dashboard";
import type { Profile } from "../data/profile";
import { useRoutines } from "../data/routines";
import { cap } from "../exercises/query";
import { useExercises } from "../exercises/useExercises";
import { computeRanks, progressOf, tierOf } from "../ranking/rank";
import { MUSCLES, RANKING_LIFTS, thresholds, TIERS } from "../ranking/standards";
import { e1rmSeries, frequencyGrid, prEvents, weekStart, weeklyVolume } from "../ranking/stats";
import { fromKg, toKg } from "../units";
import { BodyMap, MaterialDefs } from "./BodyMap";
import { FrequencyGrid, LineChart, Ring } from "./charts";
import { Sheet } from "./ExerciseSheet";
import f from "./Form.module.css";
import s from "./Dashboard.module.css";

const SEEN_KEY = "tempered.ranks.seen";
const RANGES = [
  { id: "4w", label: "4 weeks", days: 28 },
  { id: "12w", label: "12 weeks", days: 84 },
  { id: "1y", label: "1 year", days: 365 },
  { id: "all", label: "All", days: null },
] as const;

const readSeen = (): Record<string, number> | null => {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};
const writeSeen = (v: Record<string, number>) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(v));
  } catch {
    /* the ceremony may replay next load; harmless */
  }
};

export function Dashboard({ profile }: { profile: Profile }) {
  const unit = profile.weight_unit;
  const data = useDashboardData();
  const routines = useRoutines();
  const { all, byRef } = useExercises();
  const actions = useDashboardActions();

  const [view, setView] = useState<"front" | "back">("front");
  const [mode, setMode] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [liftRef, setLiftRef] = useState<string | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("12w");
  const [weight, setWeight] = useState("");
  const [ceremony, setCeremony] = useState<{ muscles: string[]; text: string; seconds: number } | null>(null);

  const sets = data.data?.sets ?? [];
  const bodyweights = data.data?.bodyweights ?? [];
  const sessions = data.data?.sessions ?? [];
  const name = (ref: string) => byRef.get(ref)?.name ?? ref.replace(/^\w+:/, "");
  const now = new Date();
  const wkStart = weekStart(now, profile.week_starts_on);

  const table = profile.standards_table;
  const ready = table !== null && bodyweights.length > 0;
  const ranks = useMemo(
    () => computeRanks(sets, bodyweights, table ?? "male", profile.standards_overrides ?? {}, (ref) => byRef.get(ref)),
    [sets, bodyweights, table, profile.standards_overrides, byRef],
  );
  const tiers = useMemo(() => new Map([...ranks.muscles].map(([m, v]) => [m, Math.floor(v.score + 1e-9)])), [ranks]);

  // Rank-up ceremony: once per crossing. The first visit only records the current tiers.
  useEffect(() => {
    if (!ready || data.isPending) return;
    const seen = readSeen();
    const current = Object.fromEntries(tiers);
    if (seen) {
      const up = [...tiers].filter(([m, t]) => t > (seen[m] ?? -1) && m in seen).map(([m, t]) => ({ m, t }));
      if (up.length) {
        const top = up.reduce((a, b) => (b.t > a.t ? b : a));
        const olympian = top.t === TIERS.length - 1;
        setCeremony({
          muscles: up.map((u) => u.m),
          text: up.length === 1 ? `${cap(up[0].m)} reached ${TIERS[up[0].t]}` : `${up.length} muscles ranked up, including ${cap(top.m)} to ${TIERS[top.t]}`,
          seconds: olympian ? 2.6 : 1.4,
        });
      }
    }
    writeSeen({ ...(seen ?? {}), ...current });
  }, [ready, data.isPending, tiers]);

  useEffect(() => {
    if (!ceremony) return;
    const id = setTimeout(() => setCeremony(null), ceremony.seconds * 1000 + 800);
    return () => clearTimeout(id);
  }, [ceremony]);

  const plannedDays = (routines.data ?? []).find((r) => r.isActive && !r.archivedAt)?.days.filter((d) => d.blocks.length).length ?? 0;
  const doneThisWeek = sessions.filter((x) => new Date(x.started_at) >= wkStart).length;

  const liftOptions = useMemo(() => {
    const refs = [...new Set(sets.filter((x) => x.reps >= 1 && x.reps <= 12).map((x) => x.exercise_ref))];
    const ranking = new Set(RANKING_LIFTS.map((l) => l.ref));
    return refs.sort((a, b) => Number(ranking.has(b)) - Number(ranking.has(a)) || name(a).localeCompare(name(b)));
  }, [sets, byRef]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = liftRef && liftOptions.includes(liftRef) ? liftRef : liftOptions[0] ?? null;
  const load = RANKING_LIFTS.find((l) => l.ref === chosen)?.load ?? "external";
  const since = RANGES.find((r) => r.id === range)!.days;
  const series = chosen
    ? e1rmSeries(sets, chosen, load, bodyweights, since ? new Date(now.getTime() - since * 86_400_000) : null).map((p) => ({ t: p.t, v: fromKg(p.e1rmKg, unit) }))
    : [];

  const volume = Object.entries(weeklyVolume(sets, (ref) => byRef.get(ref)?.primary ?? [], wkStart)).sort((a, b) => b[1] - a[1]);
  const volMax = Math.max(1, ...volume.map(([, n]) => n));
  const grid = frequencyGrid(sessions.map((x) => x.started_at), now, profile.week_starts_on, 12);
  const dayNames = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + ((profile.week_starts_on + i) % 7)).toLocaleDateString(undefined, { weekday: "short" }));
  const prs = prEvents(sets).slice(-8).reverse();
  const latestBw = bodyweights[bodyweights.length - 1]?.weight_kg ?? null;

  if (data.error) return <p className={f.error} role="alert">Could not load your dashboard: {data.error.message}</p>;
  if (data.isPending) return null;

  const overall = ranks.overall;
  const sel = selected ? ranks.muscles.get(selected) : undefined;
  const selLifts = selected ? RANKING_LIFTS.filter((l) => l.muscle === selected) : [];
  const doneLifts = selected ? [...ranks.lifts.values()].filter((lr) => lr.lift.muscle === selected).sort((a, b) => b.score - a.score) : [];

  const addWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(weight.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    actions.addBodyweight.mutate({ measured_on: new Date().toLocaleDateString("en-CA"), weight_kg: toKg(v, unit) } as never, { onSuccess: () => setWeight("") });
  };

  return (
    <div className={s.page}>
      <MaterialDefs />

      {/* Body map: the hero */}
      <section aria-label="Rank" className={s.hero}>
        <div className={s.heroTop}>
          <div className={s.seg} role="radiogroup" aria-label="Body view">
            {(["front", "back"] as const).map((v) => (
              <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)} className={s.segBtn}>{cap(v)}</button>
            ))}
          </div>
          <button className={f.quiet} onClick={() => setMode(mode === "map" ? "list" : "map")}>{mode === "map" ? "Show as list" : "Show as map"}</button>
        </div>

        {!ready ? (
          <div className={s.prompt}>
            <p className={s.promptTitle}>Add your bodyweight to see ranks</p>
            <p className={f.note}>Ranks compare your estimated 1RM with your bodyweight.</p>
            {table === null ? (
              <a className={f.button} href="#/settings" style={{ display: "inline-grid", alignItems: "center", textDecoration: "none" }}>Set up ranks</a>
            ) : (
              <form onSubmit={addWeight} className={s.inline}>
                <label>
                  <span className={s.visuallyHidden}>Bodyweight ({unit})</span>
                  <input className={f.input} inputMode="decimal" placeholder={`Bodyweight (${unit})`} value={weight} onChange={(e) => setWeight(e.target.value)} />
                </label>
                <button className={f.button} type="submit">Add bodyweight</button>
              </form>
            )}
          </div>
        ) : mode === "map" ? (
          <div className={s.mapWrap}>
            <BodyMap
              view={view} tiers={tiers} sheen={new Set(ceremony?.muscles ?? [])}
              sheenSeconds={ceremony?.seconds} onSelect={setSelected}
            />
            <div className={s.overall}>
              <span className={s.overallLabel}>Overall</span>
              <span className={s.overallTier}>{overall === null ? "No ranks yet" : TIERS[Math.floor(overall + 1e-9)]}</span>
              {overall !== null && <span className={s.overallPct}>{Math.round(progressOf(overall) * 100)}% to the next tier</span>}
              {overall === null && <span className={f.note}>Log your first session to start ranking.</span>}
            </div>
          </div>
        ) : (
          <ul className={s.muscleList}>
            {MUSCLES.map((m) => {
              const v = ranks.muscles.get(m);
              return (
                <li key={m}>
                  <button className={s.muscleRow} onClick={() => setSelected(m)}>
                    <span>{cap(m)}</span>
                    <span className={s.sub}>{v ? `${tierOf(v.score)}, ${Math.round(progressOf(v.score) * 100)}%` : "No data"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {ceremony && (
          <div className={s.ceremony} role="status">
            <span>{ceremony.text}</span>
            <button className={f.quiet} onClick={() => setCeremony(null)}>Skip</button>
          </div>
        )}
      </section>

      {ranks.flagged.length > 0 && (
        <section aria-label="Entries to check" className={`${s.section} ${s.wide}`}>
          <h2 className={s.h2}>Check these entries</h2>
          <p className={f.note}>These look too heavy to be right, so they are not ranked yet.</p>
          <ul className={s.flagList}>
            {ranks.flagged.map((x) => (
              <li key={x.set.id}>
                <span>
                  {name(x.set.exercise_ref)}: {fromKg(x.set.weight_kg, unit)} {unit} x {x.set.reps}
                  <span className={s.sub}> ({x.ratio.toFixed(1)}x bodyweight on {new Date(x.set.completed_at).toLocaleDateString()})</span>
                </span>
                <span>
                  <button className={f.quiet} onClick={() => actions.confirmSet.mutate(x.set.id as never)}>It is right</button>
                  <button className={f.quiet} onClick={() => actions.deleteSet.mutate(x.set.id as never)}>Delete set</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="This week" className={s.section}>
        <h2 className={s.h2}>This week</h2>
        <div className={s.weekRow}>
          <Ring value={doneThisWeek} total={plannedDays} label={`${doneThisWeek} of ${plannedDays} planned sessions this week`} />
          <p className={s.weekText}>
            {plannedDays ? `${doneThisWeek} of ${plannedDays} planned sessions` : `${doneThisWeek} ${doneThisWeek === 1 ? "session" : "sessions"} so far`}
            {plannedDays === 0 && <span className={s.sub}> Build a routine to plan your week.</span>}
          </p>
        </div>
      </section>

      <section aria-label="Estimated 1RM trend" className={`${s.section} ${s.wide}`}>
        <h2 className={s.h2}>Estimated 1RM</h2>
        {liftOptions.length === 0 ? (
          <p className={f.note}>Log your first session to see your estimated 1RM trend.</p>
        ) : (
          <>
            <div className={s.controls}>
              <label>
                <span className={s.visuallyHidden}>Lift</span>
                <select className={f.input} value={chosen ?? ""} onChange={(e) => setLiftRef(e.target.value)}>
                  {liftOptions.map((ref) => (
                    <option key={ref} value={ref}>{name(ref)}</option>
                  ))}
                </select>
              </label>
              <div className={s.seg} role="radiogroup" aria-label="Range">
                {RANGES.map((r) => (
                  <button key={r.id} role="radio" aria-checked={range === r.id} className={s.segBtn} onClick={() => setRange(r.id)}>{r.label}</button>
                ))}
              </div>
            </div>
            {series.length ? <LineChart points={series} unit={unit} label={`${name(chosen!)} estimated 1RM`} /> : <p className={f.note}>No sets in this range.</p>}
          </>
        )}
      </section>

      <section aria-label="Weekly volume" className={`${s.section} ${s.wide}`}>
        <h2 className={s.h2}>Weekly sets by muscle</h2>
        {volume.length === 0 ? (
          <p className={f.note}>Sets you log this week appear here.</p>
        ) : (
          <ul className={s.bars}>
            {volume.map(([m, n]) => (
              <li key={m}>
                <span className={s.barLabel}>{cap(m)}</span>
                <span className={s.barTrack}>
                  <span className={s.barFill} style={{ width: `${(n / volMax) * 100}%` }} />
                </span>
                <span className={s.barValue}>{n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Session frequency" className={s.section}>
        <h2 className={s.h2}>Sessions, last 12 weeks</h2>
        {sessions.length === 0 ? <p className={f.note}>Finished sessions fill this grid.</p> : <FrequencyGrid weeks={grid} dayNames={dayNames} />}
      </section>

      <section aria-label="Bodyweight" className={s.section}>
        <h2 className={s.h2}>Bodyweight</h2>
        {bodyweights.length > 0 && (
          <LineChart
            points={bodyweights.map((b) => ({ t: new Date(`${b.measured_on}T12:00:00`).getTime(), v: fromKg(b.weight_kg, unit) }))}
            unit={unit}
            label="Bodyweight"
          />
        )}
        <form onSubmit={addWeight} className={s.inline}>
          <label>
            <span className={s.visuallyHidden}>Add bodyweight ({unit})</span>
            <input className={f.input} inputMode="decimal" placeholder={latestBw ? `${fromKg(latestBw, unit)} ${unit}` : unit} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <button className={f.button} type="submit" disabled={actions.addBodyweight.isPending}>Add weight</button>
        </form>
      </section>

      <section aria-label="Recent personal bests" className={s.section}>
        <h2 className={s.h2}>Recent personal bests</h2>
        {prs.length === 0 ? (
          <p className={f.note}>Beat an earlier estimated 1RM and it shows up here.</p>
        ) : (
          <ul className={s.prs}>
            {prs.map((p, i) => (
              <li key={i}>
                <span>{name(p.ref)}</span>
                <span>
                  {fromKg(p.e1rmKg, unit)} {unit} <span className={s.sub}>{new Date(p.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={selected !== null} onClose={() => setSelected(null)} label={selected ? cap(selected) : "Muscle"}>
        {selected && (
          <div>
            <div className={s.sheetHead}>
              <h2 className={s.sheetTitle}>{cap(selected)}</h2>
              <button className={f.quiet} onClick={() => setSelected(null)}>Close</button>
            </div>
            {sel ? (
              <>
                <p className={s.tierName}>{tierOf(sel.score)}</p>
                <div className={s.meter} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressOf(sel.score) * 100)} aria-label="Progress to the next tier">
                  <span style={{ width: `${progressOf(sel.score) * 100}%` }} />
                </div>
                <p className={f.note}>
                  {Math.floor(sel.score + 1e-9) >= TIERS.length - 1 ? "Top tier." : `${Math.round(progressOf(sel.score) * 100)}% of the way to ${TIERS[Math.floor(sel.score + 1e-9) + 1]}.`}
                </p>
                <h3 className={f.groupTitle}>Best lift</h3>
                <p style={{ margin: 0 }}>
                  <a href={`#/library/${encodeURIComponent(sel.lift.lift.ref)}`}>{name(sel.lift.lift.ref)}</a>
                  {": "}
                  {fromKg(sel.lift.e1rmKg, unit)} {unit} estimated 1RM, {sel.lift.ratio.toFixed(2)}x bodyweight
                </p>
                {(() => {
                  const th = thresholds(sel.lift.lift, table ?? "male", profile.standards_overrides ?? {});
                  const idx = Math.floor(sel.score + 1e-9);
                  return idx < th.length && latestBw ? (
                    <p className={f.note}>Next tier needs about {fromKg(th[idx] * latestBw, unit)} {unit} estimated 1RM at your current bodyweight.</p>
                  ) : null;
                })()}
              </>
            ) : (
              <p className={f.lead}>No data yet. Log {selLifts.map((l) => name(l.ref)).join(" or ")} to rank this muscle.</p>
            )}
            {doneLifts.length > 1 && (
              <>
                <h3 className={f.groupTitle}>Ranking lifts</h3>
                <ul className={s.prs}>
                  {doneLifts.map((lr) => (
                    <li key={lr.lift.ref}>
                      <a href={`#/library/${encodeURIComponent(lr.lift.ref)}`}>{name(lr.lift.ref)}</a>
                      <span className={s.sub}>{tierOf(lr.score)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className={f.note} style={{ marginTop: 16 }}>Standards are approximate.</p>
          </div>
        )}
      </Sheet>
      {all.length === 0 && null}
    </div>
  );
}
