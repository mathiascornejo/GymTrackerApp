import { useEffect, useState, type ReactNode } from "react";
import { auth } from "../data/auth";
import { useUpdateProfile, type Profile } from "../data/profile";
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

export function Settings({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const set = update.mutate;

  return (
    <div className={f.page}>
      {profile.standards_table === null && (
        <>
          <h2 className={f.groupTitle}>Ranking setup</h2>
          <RankingSetup profile={profile} />
        </>
      )}

      <h2 className={f.groupTitle}>Training</h2>
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

      <h2 className={f.groupTitle}>Rest timer</h2>
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
      {update.error && <p className={f.error} role="alert">{update.error.message}</p>}

      <h2 className={f.groupTitle}>Account</h2>
      <div className={f.group}>
        <div className={f.row}>
          <button className={f.quiet} onClick={() => void auth.signOut()}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
