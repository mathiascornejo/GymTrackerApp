import { describe, expect, it } from "vitest";
import { defaultIncrementKg, recommend } from "./recommend";

const sets = (w: number, ...reps: number[]) => reps.map((r) => ({ weightKg: w, reps: r }));
const range = { min: 8, max: 10 };

describe("recommend", () => {
  it("gives nothing without history", () => expect(recommend([], range, 2.5)).toBeNull());

  it("adds the increment and aims for the bottom of the range when every set hit the top", () => {
    expect(recommend(sets(80, 10, 10, 10), range, 2.5)).toMatchObject({ kind: "increase", weightKg: 82.5, reps: 8 });
  });

  it("keeps the weight and aims one rep above the weakest set otherwise", () => {
    expect(recommend(sets(80, 10, 10, 9), range, 2.5)).toMatchObject({ kind: "repeat", weightKg: 80, reps: 10 });
    expect(recommend(sets(80, 9, 8, 9), range, 2.5)).toMatchObject({ kind: "repeat", weightKg: 80, reps: 9 });
  });

  it("caps the rep target at the top of the range", () => {
    expect(recommend(sets(80, 10, 10, 10, 9), { min: 8, max: 10 }, 2.5)).toMatchObject({ kind: "repeat", reps: 10 });
  });

  it("holds the weight and flags it when a set is below the minimum", () => {
    expect(recommend(sets(80, 10, 7), range, 2.5)).toMatchObject({ kind: "below-min", weightKg: 80, reps: 8 });
  });

  it("judges the last weight used, ignoring earlier lighter sets for the increase rule", () => {
    const history = [...sets(60, 10), ...sets(80, 10, 10)];
    expect(recommend(history, range, 2.5)).toMatchObject({ kind: "increase", weightKg: 82.5, lastWeightKg: 80, lastReps: [10, 10] });
  });
});

describe("defaultIncrementKg", () => {
  it("follows equipment", () => {
    expect([defaultIncrementKg("barbell"), defaultIncrementKg("dumbbell"), defaultIncrementKg("machine"), defaultIncrementKg("cable"), defaultIncrementKg(null)]).toEqual([2.5, 2, 5, 5, 2.5]);
  });
});
