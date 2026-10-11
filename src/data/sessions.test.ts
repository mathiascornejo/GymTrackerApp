import { describe, expect, it } from "vitest";
import { mergeSets, type SetRow } from "./sessions";

const row = (id: string, session = "s1"): SetRow => ({
  id, session_id: session, exercise_ref: "ds:A", block_id: null, round_index: 0, set_number: 1,
  weight_kg: 50, reps: 8, rpe: null, is_warmup: false, completed_at: "2026-01-01T00:00:00Z",
});

describe("mergeSets", () => {
  it("overlays unsent upserts and deletes on the server rows", () => {
    const merged = mergeSets([row("a"), row("b")], [{ op: "upsert", row: row("c") }, { op: "delete", id: "a", session_id: "s1" }], "s1");
    expect(merged.map((r) => r.id).sort()).toEqual(["b", "c"]);
  });
  it("replaces a row that is being re-sent", () => {
    const edited = { ...row("a"), reps: 12 };
    expect(mergeSets([row("a")], [{ op: "upsert", row: edited }], "s1")).toEqual([edited]);
  });
  it("ignores other sessions' queued sets", () => {
    expect(mergeSets([], [{ op: "upsert", row: row("x", "other") }], "s1")).toEqual([]);
  });
});
