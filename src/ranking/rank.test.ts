import { describe, expect, it } from "vitest";
import { bodyweightAt, computeRanks, effectiveLoad, progressOf, score, tierChanges, tierOf, type RankSet } from "./rank";

const TH = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.1]; // bench-like

describe("score", () => {
  it("is Wood with progress below the first threshold", () => {
    expect(score(0.25, TH)).toBeCloseTo(0.5);
    expect(tierOf(0.5)).toBe("Wood");
    expect(score(0, TH)).toBe(0);
  });
  it("adds fractional progress to the next tier", () => {
    expect(score(0.5, TH)).toBe(1); // exactly Bronze
    expect(score(0.625, TH)).toBeCloseTo(1.5);
    expect(tierOf(score(1.0, TH))).toBe("Gold");
    expect(progressOf(score(0.625, TH))).toBeCloseTo(0.5);
  });
  it("caps at Olympian", () => {
    expect(score(5, TH)).toBe(7);
    expect(tierOf(7)).toBe("Olympian");
    expect(progressOf(7)).toBe(1);
  });
});

describe("effectiveLoad", () => {
  it("applies each load model", () => {
    expect(effectiveLoad("external", 100, 80)).toBe(100);
    expect(effectiveLoad("bodyweight_plus", 20, 80)).toBe(100);
    expect(effectiveLoad("assisted", 30, 80)).toBe(50);
    expect(effectiveLoad("assisted", 200, 80)).toBe(0);
  });
});

describe("bodyweightAt", () => {
  const bw = [{ measured_on: "2026-03-01", weight_kg: 80 }, { measured_on: "2026-06-01", weight_kg: 85 }];
  it("uses the latest entry on or before the date, else the earliest", () => {
    expect(bodyweightAt("2026-04-10T10:00:00Z", bw)).toBe(80);
    expect(bodyweightAt("2026-06-01T08:00:00Z", bw)).toBe(85);
    expect(bodyweightAt("2026-01-01T00:00:00Z", bw)).toBe(80);
    expect(bodyweightAt("2026-01-01T00:00:00Z", [])).toBeNull();
  });
});

const set = (id: string, ref: string, w: number, reps: number, at = "2026-05-01T10:00:00Z", extra: Partial<RankSet> = {}): RankSet => ({
  id, exercise_ref: ref, weight_kg: w, reps, is_warmup: false, completed_at: at, ...extra,
});
const BW = [{ measured_on: "2026-01-01", weight_kg: 80 }];
const BENCH = "ds:Barbell_Bench_Press_-_Medium_Grip";

describe("computeRanks", () => {
  it("ranks the best set per lift and takes the best lift per muscle", () => {
    const r = computeRanks([set("a", BENCH, 80, 5), set("b", BENCH, 100, 5), set("c", "ds:Dumbbell_Bench_Press", 20, 10)], BW, "male");
    expect(r.lifts.get(BENCH)!.setId).toBe("b");
    expect(r.muscles.get("chest")!.lift.lift.ref).toBe(BENCH);
    expect(tierOf(r.muscles.get("chest")!.score)).toBe("Platinum"); // 116.7 / 80 = 1.46x, past 1.25 and short of 1.5
  });

  it("leaves unlogged muscles absent, not Wood", () => {
    const r = computeRanks([set("a", BENCH, 60, 5)], BW, "male");
    expect(r.muscles.has("quadriceps")).toBe(false);
  });

  it("ignores warm-ups, non-ranking lifts and sets over 12 reps", () => {
    const r = computeRanks([set("a", BENCH, 150, 5, undefined, { is_warmup: true }), set("b", "ds:Unknown", 100, 5), set("c", BENCH, 40, 20)], BW, "male");
    expect(r.lifts.size).toBe(0);
    expect(r.overall).toBeNull();
  });

  it("waits for a bodyweight", () => {
    expect(computeRanks([set("a", BENCH, 100, 5)], [], "male").lifts.size).toBe(0);
  });

  it("holds back implausible entries until confirmed", () => {
    const typo = set("typo", BENCH, 450, 3);
    const held = computeRanks([typo], BW, "male");
    expect(held.flagged.map((f) => f.set.id)).toEqual(["typo"]);
    expect(held.lifts.size).toBe(0);
    const ok = computeRanks([{ ...typo, confirmed: true }], BW, "male");
    expect(ok.flagged).toHaveLength(0);
    expect(ok.lifts.size).toBe(1);
  });

  it("uses bodyweight plus added load for pull-ups", () => {
    const r = computeRanks([set("a", "ds:Pullups", 0, 10)], BW, "male");
    expect(r.lifts.get("ds:Pullups")!.e1rmKg).toBeCloseTo(80 * (1 + 10 / 30), 3);
  });

  it("scales thresholds for the female table", () => {
    const m = computeRanks([set("a", BENCH, 60, 5)], BW, "male").muscles.get("chest")!.score;
    const f = computeRanks([set("a", BENCH, 60, 5)], BW, "female").muscles.get("chest")!.score;
    expect(f).toBeGreaterThan(m);
  });

  it("takes the median of muscles with data as overall", () => {
    const r = computeRanks([set("a", BENCH, 100, 5), set("b", "ds:Barbell_Curl", 20, 5), set("c", "ds:Barbell_Squat", 100, 5)], BW, "male");
    const scores = [...r.muscles.values()].map((m) => m.score).sort((a, b) => a - b);
    expect(r.overall).toBe(scores[1]);
  });

  it("applies user overrides over the file's standards", () => {
    const base = computeRanks([set("a", BENCH, 60, 5)], BW, "male").muscles.get("chest")!.score;
    const easy = computeRanks([set("a", BENCH, 60, 5)], BW, "male", { [BENCH]: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7] }).muscles.get("chest")!.score;
    expect(easy).toBeGreaterThan(base);
  });
});

describe("tierChanges", () => {
  it("reports muscles that crossed a tier and not first appearances", () => {
    const before = computeRanks([set("a", BENCH, 60, 5)], BW, "male");
    const after = computeRanks([set("a", BENCH, 60, 5), set("b", BENCH, 100, 5)], BW, "male");
    const changes = tierChanges(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ muscle: "chest", from: "Silver", to: "Platinum" });
    expect(tierChanges(computeRanks([], BW, "male"), after)).toEqual([]);
  });
});
