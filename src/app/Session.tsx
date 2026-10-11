import { useState } from "react";
import type { Profile } from "../data/profile";
import { startSession, useOpenSession } from "../data/sessions";
import { useRoutines } from "../data/routines";
import { useExercises } from "../exercises/useExercises";
import type { Routine } from "../routines/model";
import { PastSessions } from "./PastSessions";
import { SessionLog } from "./SessionLog";
import { SessionSummary, type SummaryData } from "./SessionSummary";
import f from "./Form.module.css";
import s from "./Session.module.css";

const weekdayName = (d: number) => new Date(2024, 0, 7 + d).toLocaleDateString(undefined, { weekday: "long" });

function StartPanel({ routine }: { routine: Routine | null }) {
  const [day, setDay] = useState(() => new Date().getDay());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async (quick: boolean) => {
    setBusy(true);
    setError("");
    try {
      await startSession({
        routineId: quick ? null : routine?.id ?? null,
        routineDayId: quick ? null : routine?.days.find((d) => d.weekday === day)?.id ?? null,
      });
    } catch (e) {
      setError(`Could not start the session: ${(e as Error).message}`);
      setBusy(false);
    }
  };

  return (
    <section className={s.start} aria-label="Start a session">
      {routine ? (
        <>
          <p className={f.lead}>Active routine: {routine.name}</p>
          <label className={s.startField}>
            Day
            <select className={f.input} value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {routine.days.map((d) => {
                const n = d.blocks.length;
                return (
                  <option key={d.weekday} value={d.weekday}>
                    {weekdayName(d.weekday)}{d.label ? ` · ${d.label}` : ""}{n ? "" : " · rest day"}
                  </option>
                );
              })}
            </select>
          </label>
          <div className={s.startActions}>
            <button className={f.button} disabled={busy} onClick={() => void start(false)}>Start session</button>
            <button className={f.quiet} disabled={busy} onClick={() => void start(true)}>Quick session</button>
          </div>
        </>
      ) : (
        <>
          <p className={f.lead}>No active routine. Start a quick session now, or build a routine in the Routines tab.</p>
          <button className={f.button} disabled={busy} onClick={() => void start(true)}>Start quick session</button>
        </>
      )}
      {error && <p className={f.error} role="alert">{error}</p>}
    </section>
  );
}

export function Session({ profile }: { profile: Profile }) {
  const open = useOpenSession();
  const routines = useRoutines();
  const { all, byRef } = useExercises();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const info = (ref: string) => byRef.get(ref);

  if (open.error) return <p className={f.error} role="alert">Could not load your session: {open.error.message}</p>;
  if (open.isPending || routines.isPending) return null;

  const active = (routines.data ?? []).find((r) => r.isActive && !r.archivedAt) ?? null;

  if (summary) return <SessionSummary data={summary} info={info} profile={profile} onDone={() => setSummary(null)} />;

  if (open.data) {
    const routine = (routines.data ?? []).find((r) => r.id === open.data!.routine_id) ?? null;
    return (
      <SessionLog
        key={open.data.id}
        session={open.data}
        routine={routine}
        profile={profile}
        info={info}
        exercises={all}
        onFinished={setSummary}
        onDiscarded={() => undefined}
      />
    );
  }

  return (
    <div>
      <StartPanel routine={active} />
      <PastSessions unit={profile.weight_unit} info={info} />
    </div>
  );
}
