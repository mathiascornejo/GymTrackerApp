import { useEffect, useMemo, useState } from "react";
import { usePushState } from "../data/push";
import type { Profile } from "../data/profile";
import { discardSession, finishSession, logSet, unlogSet, useBankCounts, useHistory, useOutbox, useSessionSets, lastSets, type SessionRow, type SetRow } from "../data/sessions";
import type { Exercise } from "../exercises/types";
import type { Routine } from "../routines/model";
import { clearDraft, loadDraft, saveDraft, type Draft } from "../session/draft";
import { buildPlan, type PlanBlock, type PlanItem } from "../session/plan";
import { defaultIncrementKg, recommend } from "../session/recommend";
import { mmss } from "../session/timer";
import { fromKg, toKg, type Unit } from "../units";
import { AddExerciseSheet } from "./AddExerciseSheet";
import { RestBar, useRestTimer } from "./RestBar";
import { epley, rankable } from "../ranking/e1rm";
import { findPRs } from "../session/summary";
import type { SummaryData } from "./SessionSummary";
import { ConfirmSheet } from "./ConfirmSheet";
import f from "./Form.module.css";
import s from "./Session.module.css";

const slot = (b: PlanBlock, itemId: string, r: number | string) => `${b.key}|${itemId}|${r}`;
const fmt = (kg: number, unit: Unit) => String(fromKg(kg, unit));

function useDraft(sessionId: string) {
  const [draft, setDraft] = useState<Draft>(() => loadDraft(sessionId));
  useEffect(() => saveDraft(sessionId, draft), [sessionId, draft]);
  return [draft, setDraft] as const;
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Keeps the screen on during an open session; releases when hidden and re-acquires on return. */
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* denied or unsupported right now; the session works without it */
      }
    };
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [enabled]);
}

type RowProps = {
  label: string;
  /** Visible label for superset rows, in place of `label`, which stays the accessible name. */
  name?: string;
  dataSlot: string;
  done: SetRow | undefined;
  input: { w: string; r: string };
  ghost: { weight_kg: number; reps: number } | null;
  unit: Unit;
  warm?: boolean;
  pr?: boolean;
  error?: string;
  onChange: (v: { w: string; r: string }) => void;
  onDone: () => void;
  /** Warm-up rows only: removes the row. */
  onRemove?: () => void;
};

function SetLine({ label, name, dataSlot, done, input, ghost, unit, warm, pr, error, onChange, onDone, onRemove }: RowProps) {
  const w = done ? fmt(done.weight_kg, unit) : input.w;
  const r = done ? String(done.reps) : input.r;
  return (
    <div className={`${s.setRow} ${done ? s.setDone : ""} ${warm ? s.warm : ""}`} data-slot={dataSlot}>
      <span className={s.setLabel}>
        {name ?? label}{pr && <span className={s.prBadge} title="Personal best estimated 1RM">PR</span>}
      </span>
      <label className={s.field}>
        <span className={s.visuallyHidden}>{label} weight ({unit})</span>
        <input
          className={s.num} inputMode="decimal" autoComplete="off" disabled={Boolean(done)} value={w}
          placeholder={ghost ? fmt(ghost.weight_kg, unit) : undefined} onChange={(e) => onChange({ ...input, w: e.target.value.replace(",", ".") })}
          name="weight"
        />
        <span className={s.unit} aria-hidden="true">{unit}</span>
      </label>
      <label className={s.field}>
        <span className={s.visuallyHidden}>{label} reps</span>
        <input
          className={s.num} inputMode="numeric" autoComplete="off" disabled={Boolean(done)} value={r}
          placeholder={ghost ? String(ghost.reps) : undefined} onChange={(e) => onChange({ ...input, r: e.target.value.replace(/\D/g, "") })}
          name="reps"
        />
        <span className={s.unit} aria-hidden="true">reps</span>
      </label>
      <button
        type="button" className={`${s.doneBtn} ${done ? s.doneOn : ""}`} aria-pressed={Boolean(done)}
        aria-label={done ? `Undo ${label}` : `Mark ${label} done`} onClick={onDone}
      >
        ✓
      </button>
      {onRemove && (
        <button type="button" className={s.removeBtn} aria-label={`Remove ${label}`} onClick={onRemove}>
          ×
        </button>
      )}
      {error && <p className={s.rowError} role="alert">{error}</p>}
    </div>
  );
}

export function SessionLog({
  session, routine, profile, info, exercises, onFinished, onDiscarded,
}: {
  session: SessionRow;
  routine: Routine | null;
  profile: Profile;
  info: (ref: string) => Exercise | undefined;
  exercises: Exercise[];
  onFinished: (data: SummaryData) => void;
  onDiscarded: () => void;
}) {
  const unit = profile.weight_unit;
  const [draft, setDraft] = useDraft(session.id);
  const { sets } = useSessionSets(session.id);
  const outbox = useOutbox();
  const [pushState] = usePushState();
  const rest = useRestTimer(pushState);
  const now = useNow(1000);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState<{ key: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useWakeLock(profile.wake_lock_enabled);

  const weekday = routine?.days.find((d) => d.id === session.routine_day_id)?.weekday ?? null;
  const adhoc = useMemo(
    () => [...new Set([...draft.adhoc, ...sets.filter((x) => !x.block_id).map((x) => x.exercise_ref)])],
    [draft.adhoc, sets],
  );
  const plan = useMemo(() => buildPlan(routine, weekday, adhoc, profile.default_rest_s), [routine, weekday, adhoc, profile.default_rest_s]);
  const refs = useMemo(() => [...new Set(plan.flatMap((b) => b.items.map((i) => i.ref)))], [plan]);
  const history = useHistory(refs, session.id);

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() - profile.week_starts_on + 7) % 7));
    return d.toISOString();
  }, [profile.week_starts_on]);
  const bankCounts = useBankCounts(plan.filter((b) => b.group === "optional" && b.blockId).map((b) => b.blockId!), weekStart, session.id);

  const nameOf = (ref: string) => info(ref)?.name ?? ref.replace(/^\w+:/, "");
  const rowFor = (b: PlanBlock, it: PlanItem, r: number, warm: boolean) =>
    sets.find((x) => x.block_id === b.blockId && x.exercise_ref === it.ref && x.round_index === r && x.is_warmup === warm);
  const roundsOf = (b: PlanBlock) => {
    const logged = sets.filter((x) => x.block_id === b.blockId && !x.is_warmup && b.items.some((i) => i.ref === x.exercise_ref));
    return Math.max(1, b.rounds + (draft.delta[b.key] ?? 0), ...logged.map((x) => x.round_index + 1));
  };
  const ghostFor = (ref: string, r: number) => {
    const last = lastSets(history.data, ref);
    return last[r] ?? last[last.length - 1] ?? null;
  };
  const incrementKg = (ref: string) => profile.increments?.[ref] ?? defaultIncrementKg(info(ref)?.equipment ?? null);
  const recFor = (it: PlanItem) =>
    recommend(lastSets(history.data, it.ref).map((x) => ({ weightKg: x.weight_kg, reps: x.reps })), { min: it.repMin, max: it.repMax }, incrementKg(it.ref));

  const patch = (fn: (d: Draft) => Draft) => setDraft((d) => fn(d));
  const setInput = (key: string, v: { w: string; r: string }) => patch((d) => ({ ...d, inputs: { ...d.inputs, [key]: v } }));

  const restFor = (b: PlanBlock, itemIndex: number) => (itemIndex < b.items.length - 1 && b.transitionRestS > 0 ? b.transitionRestS : b.restS);

  const suggested = useMemo(() => {
    const last = [...sets].sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];
    if (last) {
      const b = plan.find((p) => p.blockId === last.block_id && p.items.some((i) => i.ref === last.exercise_ref));
      if (b) return restFor(b, b.items.findIndex((i) => i.ref === last.exercise_ref));
    }
    return plan[0]?.restS ?? profile.default_rest_s;
  }, [sets, plan, profile.default_rest_s]);

  const complete = (b: PlanBlock, itemIndex: number, r: number, warm: boolean) => {
    const it = b.items[itemIndex];
    const key = slot(b, it.itemId, warm ? `w${r}` : r);
    const existing = rowFor(b, it, r, warm);
    if (existing) return unlogSet(existing);

    const input = draft.inputs[key] ?? { w: "", r: "" };
    const ghost = warm ? null : ghostFor(it.ref, r);
    const bodyOnly = info(it.ref)?.equipment === "body only";
    const w = input.w !== "" ? Number(input.w) : ghost ? fromKg(ghost.weight_kg, unit) : bodyOnly ? 0 : NaN;
    const reps = input.r !== "" ? Number(input.r) : ghost ? ghost.reps : NaN;
    if (!Number.isFinite(w) || w < 0 || !Number.isInteger(reps) || reps < 1) {
      setRowError({ key, msg: "Enter weight and reps." });
      return;
    }
    setRowError(null);
    logSet({
      id: crypto.randomUUID(),
      session_id: session.id,
      exercise_ref: it.ref,
      block_id: b.blockId,
      round_index: r,
      set_number: r + 1,
      weight_kg: toKg(w, unit),
      reps,
      rpe: null,
      is_warmup: warm,
      completed_at: new Date().toISOString(),
    });
    if (profile.auto_start_rest) rest.start(restFor(b, itemIndex));
    else if (rest.finished) rest.clear();

    // Supersets and circuits: move on to the next item of the round, or the first item of the next round.
    if (!warm) {
      const next = itemIndex < b.items.length - 1 ? slot(b, b.items[itemIndex + 1].itemId, r) : slot(b, b.items[0].itemId, r + 1);
      setTimeout(() => document.querySelector<HTMLInputElement>(`[data-slot="${CSS.escape(next)}"] input`)?.focus(), 0);
    }
  };

  const applyRecommendation = (b: PlanBlock, it: PlanItem, weightKg: number, reps: number) => {
    patch((d) => {
      const inputs = { ...d.inputs };
      for (let r = 0; r < roundsOf(b); r++) if (!rowFor(b, it, r, false)) inputs[slot(b, it.itemId, r)] = { w: fmt(weightKg, unit), r: String(reps) };
      return { ...d, inputs };
    });
  };

  const addRound = (b: PlanBlock) => patch((d) => ({ ...d, delta: { ...d.delta, [b.key]: (d.delta[b.key] ?? 0) + 1 } }));
  const removeRound = (b: PlanBlock) => {
    const last = roundsOf(b) - 1;
    if (last < 1 || b.items.some((i) => rowFor(b, i, last, false))) return;
    patch((d) => ({ ...d, delta: { ...d.delta, [b.key]: (d.delta[b.key] ?? 0) - 1 } }));
  };
  const warmCount = (b: PlanBlock, it: PlanItem) => draft.warm[`${b.key}|${it.itemId}`] ?? 0;
  const addWarm = (b: PlanBlock, it: PlanItem) =>
    patch((d) => ({ ...d, warm: { ...d.warm, [`${b.key}|${it.itemId}`]: warmCount(b, it) + 1 } }));
  // Only the last warm-up can go, so the numbering of the ones before it never shifts. A logged one is unlogged too.
  const removeWarm = (b: PlanBlock, it: PlanItem) => {
    const n = warmCount(b, it);
    if (n < 1) return;
    const row = rowFor(b, it, n - 1, true);
    if (row) unlogSet(row);
    patch((d) => {
      const { [slot(b, it.itemId, `w${n - 1}`)]: _typed, ...inputs } = d.inputs;
      return { ...d, inputs, warm: { ...d.warm, [`${b.key}|${it.itemId}`]: n - 1 } };
    });
  };
  const toggleSkip = (b: PlanBlock) =>
    patch((d) => ({ ...d, skipped: d.skipped.includes(b.key) ? d.skipped.filter((k) => k !== b.key) : [...d.skipped, b.key] }));

  const blockDone = (b: PlanBlock) =>
    b.items.every((it) => Array.from({ length: roundsOf(b) }, (_, r) => r).every((r) => rowFor(b, it, r, false)));
  // Finish stays quiet until every planned, non-skipped set is logged; optional bank work never holds it back.
  const required = plan.filter((b) => b.group !== "optional" && !draft.skipped.includes(b.key));
  const allDone = required.length > 0 && required.every(blockDone);
  // Desktop side panel follows the first planned block that still has sets to log.
  const current = required.find((b) => !blockDone(b)) ?? null;

  const finish = async () => {
    setBusy(true);
    setError("");
    try {
      await finishSession(session.id);
      clearDraft(session.id);
      rest.clear();
      onFinished({ session: { ...session, ended_at: new Date().toISOString() }, sets, prior: history.data ?? [], unit });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const discard = async () => {
    setConfirmDiscard(false);
    setBusy(true);
    try {
      await discardSession(session.id);
      clearDraft(session.id);
      rest.clear();
      onDiscarded();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const saving = outbox.status === "saving" ? "Saving" : outbox.status === "retry" ? "Will retry" : "Saved";
  const elapsed = Math.max(0, Math.floor((now - new Date(session.started_at).getTime()) / 1000));
  const dayLabel = routine?.days.find((d) => d.id === session.routine_day_id)?.label;
  const title = weekday === null ? "Quick session" : dayLabel || new Date(2024, 0, 7 + weekday).toLocaleDateString(undefined, { weekday: "long" });
  const pr = useMemo(() => findPRs(sets, history.data ?? []), [sets, history.data]);
  // A set is a record when it beats every earlier set of that lift, and there was earlier history to beat.
  const prRows = useMemo(() => {
    const best = new Map<string, number>();
    for (const h of history.data ?? []) if (rankable(h.reps)) best.set(h.exercise_ref, Math.max(best.get(h.exercise_ref) ?? 0, epley(h.weight_kg, h.reps)));
    const baseline = new Set(best.keys());
    const out = new Set<string>();
    [...sets].filter((x) => !x.is_warmup && rankable(x.reps)).sort((a, b) => a.completed_at.localeCompare(b.completed_at)).forEach((x) => {
      const e = epley(x.weight_kg, x.reps);
      const prev = best.get(x.exercise_ref) ?? 0;
      if (baseline.has(x.exercise_ref) && e > prev + 1e-9) out.add(x.id);
      best.set(x.exercise_ref, Math.max(prev, e));
    });
    return out;
  }, [sets, history.data]);

  const renderBlock = (b: PlanBlock) => {
    const rounds = roundsOf(b);
    const skipped = draft.skipped.includes(b.key);
    const isDone = blockDone(b);
    const group = b.kind !== "single";
    const names = b.items.map((i) => nameOf(i.ref));

    const chip = (it: PlanItem) => {
      const rec = recFor(it);
      if (!rec) return null;
      const lastText = rec.lastReps.join(", ");
      const reason =
        rec.kind === "increase"
          ? `Hit ${lastText} at ${fmt(rec.lastWeightKg, unit)} ${unit} last time`
          : rec.kind === "repeat"
            ? `Hit ${lastText} last time`
            : `Fell below ${it.repMin} reps last time. Same weight, no deload.`;
      return (
        <div className={s.rec} key={`rec-${it.itemId}`}>
          <button type="button" className={s.recChip} onClick={() => applyRecommendation(b, it, rec.weightKg, rec.reps)}>
            Try {fmt(rec.weightKg, unit)} x {rec.reps}
          </button>
          <span className={s.recReason}>{group ? `${nameOf(it.ref)}: ` : ""}{reason}</span>
        </div>
      );
    };

    const line = (itemIndex: number, r: number, warm: boolean, label: string, name?: string) => {
      const it = b.items[itemIndex];
      const key = slot(b, it.itemId, warm ? `w${r}` : r);
      return (
        <SetLine
          key={key} label={label} name={name} dataSlot={key} warm={warm} unit={unit}
          done={rowFor(b, it, r, warm)} pr={!warm && prRows.has(rowFor(b, it, r, warm)?.id ?? "")} input={draft.inputs[key] ?? { w: "", r: "" }} ghost={warm ? null : ghostFor(it.ref, r)}
          error={rowError?.key === key ? rowError.msg : undefined}
          onChange={(v) => setInput(key, v)} onDone={() => complete(b, itemIndex, r, warm)}
          onRemove={warm && r === warmCount(b, it) - 1 ? () => removeWarm(b, it) : undefined}
        />
      );
    };

    return (
      <article key={b.key} className={`${s.block} ${skipped ? s.skipped : ""}`} aria-label={names.join(" and ")}>
        <header className={s.blockHead}>
          <div>
            <h3 className={s.blockTitle}>
              {group ? names.join(" + ") : <a href={`#/library/${encodeURIComponent(b.items[0].ref)}`}>{names[0]}</a>}
            </h3>
            <p className={s.blockMeta}>
              {group ? `${b.kind === "superset" ? "Superset" : "Circuit"}, ${rounds} rounds` : `${rounds} sets`}
              {" · "}rest {mmss(b.restS)}
              {b.items.length === 1 && ` · ${b.items[0].repMin}–${b.items[0].repMax} reps`}
              {b.weeklyTarget ? ` · ${bankCounts.get(b.blockId ?? "")?.size ?? 0} of ${b.weeklyTarget} this week` : ""}
            </p>
          </div>
          {skipped ? <span className={s.badge}>Skipped</span> : isDone ? <span className={s.badgeDone}>Done</span> : null}
        </header>

        {!skipped && (
          <>
            {b.items.map(chip)}
            {b.items.map((it, i) =>
              Array.from({ length: warmCount(b, it) }, (_, n) =>
                line(i, n, true, `Warm-up ${n + 1}${group ? ` ${nameOf(it.ref)}` : ""}`, group ? `${nameOf(it.ref)}, warm-up ${n + 1}` : undefined),
              ),
            )}
            {Array.from({ length: rounds }, (_, r) =>
              group ? (
                <div key={r} className={s.round}>
                  <h4 className={s.roundTitle}>Round {r + 1}</h4>
                  {b.items.map((it, i) => line(i, r, false, `${nameOf(it.ref)} round ${r + 1}`, nameOf(it.ref)))}
                </div>
              ) : (
                line(0, r, false, `Set ${r + 1}`)
              ),
            )}
          </>
        )}

        <details className={s.more}>
          <summary>More</summary>
          <div className={s.moreRow}>
            {!skipped && <button type="button" className={f.quiet} onClick={() => addRound(b)}>{group ? "Add round" : "Add set"}</button>}
            {!skipped && <button type="button" className={f.quiet} onClick={() => removeRound(b)}>{group ? "Remove round" : "Remove set"}</button>}
            {!skipped &&
              b.items.map((it) => (
                <button type="button" key={it.itemId} className={f.quiet} onClick={() => addWarm(b, it)}>
                  Add warm-up{group ? ` for ${nameOf(it.ref)}` : ""}
                </button>
              ))}
            <button type="button" className={f.quiet} onClick={() => toggleSkip(b)}>{skipped ? "Undo skip" : "Skip exercise"}</button>
          </div>
        </details>
      </article>
    );
  };

  const main = plan.filter((b) => b.group === "main");
  const accessories = plan.filter((b) => b.group === "accessory");
  const optional = plan.filter((b) => b.group === "optional");

  return (
    <div className={s.log} data-session-open="">
      <div className={s.logMain}>
      <div className={s.logHead}>
        {/* Phone hides the tab bar during a session; this is the way back. The session stays open. */}
        <a href="#/dashboard" className={`${f.quiet} ${s.exit}`} aria-label="Exit, the session stays open">Exit</a>
        <div className={s.logTitleBlock}>
          <h2 className={s.logTitle}>{title}</h2>
          <p className={s.blockMeta}>
            {mmss(elapsed)} · <span role="status" className={outbox.status === "retry" ? s.warnText : ""}>{saving}</span>
          </p>
        </div>
        <button type="button" className={`${allDone ? f.button : f.quiet} ${s.finish}`} disabled={busy} onClick={() => void finish()}>Finish session</button>
      </div>
      {outbox.failure && <p className={f.error} role="alert">{outbox.failure}</p>}
      {error && <p className={f.error} role="alert">{error}</p>}
      {pr.length > 0 && <p className={s.prLine}>New best: {pr.map((p) => nameOf(p.ref)).join(", ")}</p>}

      {plan.length === 0 && <p className={f.lead}>Nothing is planned for today. Add an exercise to start logging.</p>}
      <div className={s.blocks}>{main.map(renderBlock)}</div>

      {accessories.length > 0 && (
        <details className={s.group} open>
          <summary>Accessories ({accessories.length})</summary>
          <div className={s.blocks}>{accessories.map(renderBlock)}</div>
        </details>
      )}
      {optional.length > 0 && (
        <details className={s.group}>
          <summary>Optional this week ({optional.length})</summary>
          <div className={s.blocks}>{optional.map(renderBlock)}</div>
        </details>
      )}

      <div className={s.logFoot}>
        <button type="button" className={f.quiet} onClick={() => setAdding(true)}>Add exercise</button>
        <button type="button" className={`${f.quiet} ${f.danger}`} style={{ marginLeft: "auto" }} disabled={busy} onClick={() => setConfirmDiscard(true)}>Discard session</button>
        <ConfirmSheet
          open={confirmDiscard}
          title="Discard this session?"
          body="Its logged sets will be removed."
          confirmLabel="Discard session"
          destructive
          onClose={() => setConfirmDiscard(false)}
          onConfirm={() => void discard()}
        />
      </div>
      </div>

      <aside className={s.logSide} aria-label="Rest and up next">
        <RestBar rest={rest} suggestedS={suggested} />
        {current && (
          <section className={s.sideCard} aria-label="Up next">
            <h3 className={s.sideLabel}>Up next</h3>
            {current.items.map((it) => {
              const last = lastSets(history.data, it.ref);
              const rec = recFor(it);
              return (
                <div key={it.itemId} className={s.sideItem}>
                  <p className={s.blockTitle}>{nameOf(it.ref)}</p>
                  <p className={s.blockMeta}>
                    {last.length ? `Last time: ${last.map((x) => `${fmt(x.weight_kg, unit)} × ${x.reps}`).join(", ")}` : "No earlier sets"}
                  </p>
                  {rec && <p className={s.sideRec}>Suggested: {fmt(rec.weightKg, unit)} {unit} × {rec.reps}</p>}
                </div>
              );
            })}
          </section>
        )}
      </aside>

      <AddExerciseSheet
        open={adding}
        exercises={exercises}
        onClose={() => setAdding(false)}
        onAdd={(ref) => patch((d) => ({ ...d, adhoc: d.adhoc.includes(ref) ? d.adhoc : [...d.adhoc, ref] }))}
      />
    </div>
  );
}
