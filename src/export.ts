// Data export. Pure so the escaping and shape are tested; the Settings screen only fetches and downloads.

export type ExportSet = {
  session_id: string;
  exercise_ref: string;
  round_index: number;
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  completed_at: string;
};
export type ExportSession = { id: string; started_at: string; ended_at: string | null; notes: string; routine_id: string | null };

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote anything that could break a row, and neutralise spreadsheet formulas in free text.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" && s !== "" && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

/** One row per set, with the session it belongs to and a readable exercise name. Weights stay in kilograms. */
export function setsCsv(sessions: ExportSession[], sets: ExportSet[], nameOf: (ref: string) => string) {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const rows = [...sets]
    .sort((a, b) => a.completed_at.localeCompare(b.completed_at))
    .map((x) => [
      byId.get(x.session_id)?.started_at ?? "",
      x.session_id,
      x.exercise_ref,
      nameOf(x.exercise_ref),
      x.round_index + 1,
      x.set_number,
      x.weight_kg,
      x.reps,
      x.rpe,
      x.is_warmup ? "yes" : "no",
      x.completed_at,
    ]);
  return toCsv(
    ["session_started_at", "session_id", "exercise_ref", "exercise", "round", "set_number", "weight_kg", "reps", "rpe", "warmup", "completed_at"],
    rows,
  );
}

export const sessionsCsv = (sessions: ExportSession[], sets: ExportSet[]) =>
  toCsv(
    ["session_id", "started_at", "ended_at", "duration_minutes", "working_sets", "volume_kg", "notes"],
    sessions.map((s) => {
      const mine = sets.filter((x) => x.session_id === s.id && !x.is_warmup);
      const minutes = s.ended_at ? Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 60000) : "";
      return [s.id, s.started_at, s.ended_at, minutes, mine.length, Math.round(mine.reduce((n, x) => n + x.weight_kg * x.reps, 0) * 100) / 100, s.notes];
    }),
  );
