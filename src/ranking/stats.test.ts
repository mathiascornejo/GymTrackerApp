import { describe, expect, it } from "vitest";
import type { RankSet } from "./rank";
import { e1rmSeries, frequencyGrid, movingAverage, volumeBar, prEvents, weekStart, weeklyVolume } from "./stats";

const s = (id: string, ref: string, w: number, reps: number, at: string, warm = false): RankSet => ({
  id, exercise_ref: ref, weight_kg: w, reps, is_warmup: warm, completed_at: at,
});

describe("weekStart", () => {
  it("finds the start of the week for a given first day", () => {
    const wed = new Date(2026, 9, 14, 15, 30); // Wednesday 14 Oct 2026
    expect(weekStart(wed, 1).getDate()).toBe(12);
    expect(weekStart(wed, 0).getDate()).toBe(11);
    expect(weekStart(wed, 3).getDate()).toBe(14);
  });
});

describe("weeklyVolume", () => {
  it("counts working sets per primary muscle since the cutoff", () => {
    const from = new Date(2026, 9, 12);
    const out = weeklyVolume(
      [s("a", "bench", 100, 5, new Date(2026, 9, 13).toISOString()), s("b", "bench", 100, 5, new Date(2026, 9, 5).toISOString()), s("c", "bench", 40, 10, new Date(2026, 9, 13).toISOString(), true)],
      () => ["chest"],
      from,
    );
    expect(out).toEqual({ chest: 1 });
  });
});

describe("frequencyGrid", () => {
  it("places sessions in 12 week columns by weekday", () => {
    const now = new Date(2026, 9, 14);
    const grid = frequencyGrid([new Date(2026, 9, 12, 9).toISOString(), new Date(2026, 9, 14, 18).toISOString(), new Date(2026, 9, 14, 7).toISOString(), new Date(2025, 0, 1).toISOString()], now, 1, 12);
    expect(grid).toHaveLength(12);
    const last = grid[11];
    expect(last.days).toEqual([1, 0, 2, 0, 0, 0, 0]); // Monday 1, Wednesday 2
    expect(grid.slice(0, 11).every((w) => w.days.every((n) => n === 0))).toBe(true);
  });
});

describe("e1rmSeries", () => {
  it("keeps the best estimate per day, oldest first, within the range", () => {
    const sets = [
      s("a", "x", 100, 5, new Date(2026, 8, 1, 10).toISOString()),
      s("b", "x", 110, 3, new Date(2026, 8, 1, 11).toISOString()),
      s("c", "x", 100, 8, new Date(2026, 9, 1, 10).toISOString()),
      s("d", "x", 120, 20, new Date(2026, 9, 2, 10).toISOString()),
    ];
    const series = e1rmSeries(sets, "x", "external", [], null);
    expect(series).toHaveLength(2);
    expect(series[0].e1rmKg).toBeCloseTo(Math.max(100 * (1 + 5 / 30), 110 * (1 + 3 / 30)), 3);
    expect(e1rmSeries(sets, "x", "external", [], new Date(2026, 9, 1))).toHaveLength(1);
  });
  it("adds bodyweight for bodyweight_plus lifts and skips them without one", () => {
    const sets = [s("a", "p", 0, 10, new Date(2026, 9, 1).toISOString())];
    expect(e1rmSeries(sets, "p", "bodyweight_plus", [], null)).toEqual([]);
    expect(e1rmSeries(sets, "p", "bodyweight_plus", [{ measured_on: "2026-01-01", weight_kg: 80 }], null)[0].e1rmKg).toBeCloseTo(80 * (1 + 10 / 30), 3);
  });
});

describe("prEvents", () => {
  it("lists each improvement and skips the first log", () => {
    const evs = prEvents([
      s("1", "x", 100, 5, "2026-01-01T10:00:00Z"),
      s("2", "x", 100, 5, "2026-01-08T10:00:00Z"),
      s("3", "x", 105, 5, "2026-01-15T10:00:00Z"),
      s("4", "x", 60, 5, "2026-01-22T10:00:00Z", true),
    ]);
    expect(evs.map((e) => e.at)).toEqual(["2026-01-15T10:00:00Z"]);
    expect(evs[0].previousKg).toBeCloseTo(100 * (1 + 5 / 30), 3);
  });
});

describe("movingAverage", () => {
  const day = (n: number) => n * 86_400_000;
  it("averages the trailing seven calendar days, not the last seven entries", () => {
    const pts = [{ t: day(0), v: 70 }, { t: day(3), v: 72 }, { t: day(6), v: 74 }, { t: day(7), v: 76 }];
    expect(movingAverage(pts).map((p) => p.v)).toEqual([70, 71, 72, 74]);
  });
});

describe("volumeBar", () => {
  it("scales against a fixed target, not the week's maximum", () => {
    expect(volumeBar(15, { min: 10, max: 20 })).toEqual({ fill: 50, bandFrom: (10 / 30) * 100, bandTo: (20 / 30) * 100 });
    expect(volumeBar(45, { min: 10, max: 20 }).fill).toBe(100);
    expect(volumeBar(0).fill).toBe(0);
  });
});
