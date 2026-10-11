import { describe, expect, it } from "vitest";
import { epley, rankable } from "./e1rm";

describe("epley", () => {
  it("returns the weight for a single", () => expect(epley(140, 1)).toBe(140));
  it("applies weight * (1 + reps/30)", () => {
    expect(epley(100, 10)).toBeCloseTo(133.333, 3);
    expect(epley(60, 5)).toBeCloseTo(70, 5);
  });
  it("is 0 for zero reps", () => expect(epley(100, 0)).toBe(0));
});

describe("rankable", () => {
  it("accepts 1 to 12 reps only", () => {
    expect([0, 1, 12, 13].map(rankable)).toEqual([false, true, true, false]);
  });
});
