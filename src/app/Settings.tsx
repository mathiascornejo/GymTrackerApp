import { useEffect, useState, type ReactNode } from "react";
import { auth, useSession } from "../data/auth";
import { deleteAccount, fetchFullExport } from "../data/account";
import { sessionsCsv, setsCsv } from "../export";
import { exportRoutine } from "../routines/model";
import { useUpdateProfile, type Profile } from "../data/profile";
import { useRoutines } from "../data/routines";
import { useExercises } from "../exercises/useExercises";
import { RANKING_LIFTS, thresholds, TIERS } from "../ranking/standards";
import { AlarmSettings } from "./AlarmSettings";
import { RankingSetup } from "./RankingSetup";
import f from "./Form.module.css";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The query cache notifies React asynchronously, so a bare controlled input snaps back to its old value for a frame.
// Mirroring locally keeps the control where the user put it; a failed save changes the prop and resets it.
function useMirror<T>(value: T) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return [v, setV] as const;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [v, setV] = useMirror(checked);
  return (
    <input
      className={f.toggle}
      type="checkbox"
      role="switch"
      checked={v}
      onChange={(e) => {
        setV(e.target.checked);
        onChange(e.target.checked);
      }}
    />
  );
}

function Select({ value, onChange, children }: { value: string | number; onChange: (v: string) => void; children: ReactNode }) {
  const [v, setV] = useMirror(value);
  return (
    <select
      className={f.input}
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        onChange(e.target.value);
      }}
    >
      {children}
    </select>
  );
}

const BOUNDS = TIERS.slice(1);

/** Edits one lift's seven thresholds. Values must be positive and rising; a bad edit reverts with a reason. */
function StandardsEditor({ profile }: { profile: Profile }) {
  const { byRef } = useExercises();
  const update = useUpdateProfile();
  const [error, setError] = useState("");
  const table = profile.standards_table ?? "male";
  const overrides = profile.standards_overrides ?? {};
  const save = (next: Record<string, number[]>) => update.mutate({ standards_overrides: next });

  return (
    <details className={f.group}>
      <summary className={f.summary}>Edit strength standards</summary>
      <p className={f.note}>
        Bodyweight multiples of estimated 1RM needed to reach each tier. The built-in numbers are approximate placeholders; change any you
        trust a better source for.
      </p>
      {error && <p className={f.error} role="alert">{error}</p>}
      <div className={f.liftList} data-thumb="">
      {RANKING_LIFTS.map((lift) => {
        const name = byRef.get(lift.ref)?.name ?? lift.ref;
        const current = thresholds(lift, table, overrides);
        const custom = Boolean(overrides[lift.ref]);
        return (
          <fieldset key={lift.ref} className={f.lift}>
            <legend className={f.liftName}>
              {name} <span className={f.note}>({lift.muscle}{custom ? ", edited" : ""})</span>
            </legend>
            <div className={f.liftGrid}>
              {current.map((v, i) => (
                <label key={`${lift.ref}-${i}-${v}`} className={f.liftCell}>
                  {BOUNDS[i]}
                  <input
                    className={`${f.input} ${f.liftInput}`} inputMode="decimal" defaultValue={v}
                    aria-label={`${name} ${BOUNDS[i]} multiple`}
                    onBlur={(e) => {
                      const n = Number(e.target.value.replace(",", "."));
                      if (n === v) return;
                      const next = [...current];
                      next[i] = n;
                      const rising = next.every((x, k) => Number.isFinite(x) && x > 0 && (k === 0 || x > next[k - 1]));
                      if (!rising) {
                        setError(`${name}: each tier must be a positive multiple higher than the one before.`);
                        e.target.value = String(v);
                        return;
                      }
                      setError("");
                      save({ ...overrides, [lift.ref]: next });
                    }}
                  />
                </label>
              ))}
            </div>
            {custom && (
              <button
                type="button" className={`${f.quiet} ${f.liftReset}`}
                onClick={() => {
                  const { [lift.ref]: _removed, ...rest } = overrides;
                  save(rest);
                }}
              >
                Reset {name}
              </button>
            )}
          </fieldset>
        );
      })}
      </div>
    </details>
  );
}

function download(name: string, mime: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Export, delete and sign out. Delete needs the account email typed back, and the server checks it again. */
function AccountSection({ profile }: { profile: Profile }) {
  const email = useSession()?.user.email ?? "";
  const { byRef } = useExercises();
  const routines = useRoutines();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const stamp = new Date().toISOString().slice(0, 10);
  const name = (ref: string) => byRef.get(ref)?.name ?? ref;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <section className={f.card}>
      <h2 className={f.cardTitle}>Your data</h2>
      <div className={f.group}>
        <div className={f.stack}>
          <p className={f.note} style={{ margin: 0 }}>Weights are exported in kilograms, whatever unit you display.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <button className={f.quiet} disabled={busy !== ""} onClick={() => void run("sets", async () => { const d = await fetchFullExport(); download(`tempered-sets-${stamp}.csv`, "text/csv", setsCsv(d.sessions, d.sets, name)); })}>
              Export sets (CSV)
            </button>
            <button className={f.quiet} disabled={busy !== ""} onClick={() => void run("sessions", async () => { const d = await fetchFullExport(); download(`tempered-sessions-${stamp}.csv`, "text/csv", sessionsCsv(d.sessions, d.sets)); })}>
              Export sessions (CSV)
            </button>
            <button
              className={f.quiet}
              disabled={busy !== ""}
              onClick={() =>
                void run("json", async () => {
                  const d = await fetchFullExport();
                  download(`tempered-export-${stamp}.json`, "application/json", JSON.stringify({ exportedAt: new Date().toISOString(), unit: "kg", profile: { display_name: profile.display_name, weight_unit: profile.weight_unit }, routines: (routines.data ?? []).map(exportRoutine), ...d }, null, 2));
                })
              }
            >
              Export everything (JSON)
            </button>
          </div>
          {busy && <p className={f.note} role="status">Preparing your export.</p>}
        </div>
      </div>
      </section>

      <section className={f.card}>
      <h2 className={f.cardTitle}>Delete account</h2>
      <details className={f.group}>
        <summary className={f.summary}>Delete my account and data</summary>
        <div style={{ paddingBottom: 16, display: "grid", gap: 12 }}>
          <p style={{ margin: 0 }}>
            This permanently deletes your account and everything in it: sessions, sets, routines, custom exercises, bodyweight and
            notification subscriptions. It cannot be undone. Export your data first if you want a copy.
          </p>
          <label style={{ display: "grid", gap: 4, fontSize: 15 }}>
            Type your email ({email}) to confirm
            <input className={f.input} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} style={{ textAlign: "left" }} />
          </label>
          <button
            className={`${f.button} ${f.danger}`}
            disabled={busy !== "" || !email || typed.trim().toLowerCase() !== email.toLowerCase()}
            onClick={() => void run("delete", () => deleteAccount(email))}
          >
            Delete account and all data
          </button>
        </div>
      </details>
      </section>
      {error && <p className={`${f.error} ${f.wide}`} role="alert">{error}</p>}
    </>
  );
}

export function Settings({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const set = update.mutate;

  return (
    <div className={f.settings}>
      {profile.standards_table === null && (
        <section className={`${f.card} ${f.wide}`}>
          <h2 className={f.cardTitle}>Ranking setup</h2>
          <RankingSetup profile={profile} />
        </section>
      )}

      <section className={`${f.card} ${f.wide}`}>
      <h2 className={f.cardTitle}>Training</h2>
      <div className={f.group}>
        <label className={f.row}>
          <span className={f.label}>Display name</span>
          <input className={f.input} defaultValue={profile.display_name} onBlur={(e) => e.target.value !== profile.display_name && set({ display_name: e.target.value.trim() })} />
        </label>
        <label className={f.row}>
          <span className={f.label}>Weight unit</span>
          <Select value={profile.weight_unit} onChange={(v) => set({ weight_unit: v as Profile["weight_unit"] })}>
            <option value="kg">Kilograms</option>
            <option value="lb">Pounds</option>
          </Select>
        </label>
        <label className={f.row}>
          <span className={f.label}>Theme</span>
          <Select value={profile.theme} onChange={(v) => set({ theme: v as Profile["theme"] })}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </label>
        <label className={f.row}>
          <span className={f.label}>Week starts on</span>
          <Select value={profile.week_starts_on} onChange={(v) => set({ week_starts_on: Number(v) })}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </Select>
        </label>
        <label className={f.row}>
          <span className={f.label}>Strength standards</span>
          <Select value={profile.standards_table ?? ""} onChange={(v) => set({ standards_table: v as "male" | "female" })}>
            {profile.standards_table === null && <option value="" disabled>Not set</option>}
            <option value="male">Male</option>
            <option value="female">Female</option>
          </Select>
        </label>
      </div>
      <p className={f.note}>Standards are approximate.</p>
      <StandardsEditor profile={profile} />
      </section>

      <section className={f.card}>
      <h2 className={f.cardTitle}>Rest timer</h2>
      <div className={f.group}>
        <label className={f.row}>
          <span className={f.label}>Default rest (seconds)</span>
          <input
            className={f.input}
            inputMode="numeric"
            defaultValue={profile.default_rest_s}
            onBlur={(e) => {
              const v = Math.min(3600, Math.max(0, Math.round(Number(e.target.value))));
              if (Number.isFinite(v) && v !== profile.default_rest_s) set({ default_rest_s: v });
              else e.target.value = String(profile.default_rest_s);
            }}
          />
        </label>
        <label className={f.row}>
          <span className={f.label}>Keep screen awake during a session</span>
          <Toggle checked={profile.wake_lock_enabled} onChange={(v) => set({ wake_lock_enabled: v })} />
        </label>
        <label className={f.row}>
          <span className={f.label}>Start rest after each set</span>
          <Toggle checked={profile.auto_start_rest} onChange={(v) => set({ auto_start_rest: v })} />
        </label>
      </div>
      </section>
      {update.error && <p className={`${f.error} ${f.wide}`} role="alert">{update.error.message}</p>}

      <AlarmSettings />

      <AccountSection profile={profile} />

      <section className={f.card}>
        <h2 className={f.cardTitle}>Account</h2>
        <div className={f.group}>
          <div className={f.row}>
            <button className={f.quiet} onClick={() => void auth.signOut()}>Sign out</button>
          </div>
          <div className={f.row}>
            <a href="#/about">About Tempered</a>
          </div>
        </div>
      </section>
    </div>
  );
}
