import { describe, expect, it } from "vitest";
import { adjustTimer, mmss, remainingS, startTimer } from "./timer";

describe("rest timer", () => {
  it("counts down from an absolute end time", () => {
    const t = startTimer(90, 1_000_000);
    expect(remainingS(t, 1_000_000)).toBe(90);
    expect(remainingS(t, 1_000_000 + 30_000)).toBe(60);
    // Returning from a long background pause: no drift, just the clock.
    expect(remainingS(t, 1_000_000 + 10 * 60_000)).toBe(0);
  });
  it("adds and removes fifteen seconds without going negative", () => {
    const t = startTimer(90, 0)!;
    expect(remainingS(adjustTimer(t, 15, 0), 0)).toBe(105);
    expect(remainingS(adjustTimer(t, -15, 0), 0)).toBe(75);
    expect(remainingS(adjustTimer(t, -15, 80_000), 80_000)).toBe(0);
  });
  it("is zero without a timer", () => expect(remainingS(null, 5)).toBe(0));
  it("formats mm:ss", () => expect([mmss(90), mmss(5), mmss(600)]).toEqual(["1:30", "0:05", "10:00"]));
});
