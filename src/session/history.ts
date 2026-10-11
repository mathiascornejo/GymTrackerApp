export type HistorySet = { session_id: string; exercise_ref: string; round_index: number; set_number: number; weight_kg: number; reps: number; completed_at: string };

/** The most recent session's working sets for one exercise, in the order they were performed. */
export function lastSessionSets<T extends HistorySet>(history: T[], ref: string): T[] {
  const mine = history.filter((s) => s.exercise_ref === ref);
  if (!mine.length) return [];
  const latest = mine.reduce((a, b) => (b.completed_at > a.completed_at ? b : a)).session_id;
  return mine.filter((s) => s.session_id === latest).sort((a, b) => a.round_index - b.round_index || a.set_number - b.set_number);
}
