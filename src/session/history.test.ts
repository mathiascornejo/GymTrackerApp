import { describe, expect, it } from "vitest";
import { lastSessionSets, type HistorySet } from "./history";

const h = (session: string, ref: string, round: number, at: string, w = 50, reps = 8): HistorySet => ({
  session_id: session, exercise_ref: ref, round_index: round, set_number: round + 1, weight_kg: w, reps, completed_at: at,
});

describe("lastSessionSets", () => {
  it("returns only the latest session for the exercise, in set order", () => {
    const rows = [h("old", "a", 0, "2026-01-01"), h("new", "a", 1, "2026-02-02T10:05"), h("new", "a", 0, "2026-02-02T10:00"), h("new", "b", 0, "2026-03-03")];
    expect(lastSessionSets(rows, "a").map((s) => [s.session_id, s.round_index])).toEqual([["new", 0], ["new", 1]]);
  });
  it("is empty without history", () => expect(lastSessionSets([], "a")).toEqual([]));
});
