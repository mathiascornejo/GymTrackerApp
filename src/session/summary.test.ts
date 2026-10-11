import { describe, expect, it } from "vitest";
import { findPRs, summarize, type SetLike } from "./summary";

const s = (ref: string, w: number, reps: number, warm = false): SetLike => ({ exercise_ref: ref, weight_kg: w, reps, is_warmup: warm });

describe("summarize", () => {
  it("sums weight x reps for working sets only", () => {
    expect(summarize([s("a", 100, 5), s("a", 100, 5), s("a", 40, 10, true)])).toEqual({ volumeKg: 1000, workingSets: 2 });
  });
});

describe("findPRs", () => {
  it("flags an exercise whose best e1RM beats history", () => {
    const prs = findPRs([s("bench", 100, 5)], [s("bench", 100, 3), s("bench", 90, 8)]);
    expect(prs).toHaveLength(1);
    expect(prs[0].ref).toBe("bench");
    expect(prs[0].e1rmKg).toBeCloseTo(116.67, 1);
  });
  it("is not a record when equal or lower", () => {
    expect(findPRs([s("bench", 100, 5)], [s("bench", 100, 5)])).toEqual([]);
    expect(findPRs([s("bench", 80, 5)], [s("bench", 100, 5)])).toEqual([]);
  });
  it("treats the first ever log as no record", () => {
    expect(findPRs([s("bench", 100, 5)], [])).toEqual([]);
  });
  it("ignores warm-ups and sets over 12 reps", () => {
    expect(findPRs([s("bench", 200, 1, true), s("bench", 50, 20)], [s("bench", 100, 5)])).toEqual([]);
  });
});
