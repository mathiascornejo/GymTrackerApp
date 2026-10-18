import { describe, expect, it } from "vitest";
import { stepCalories } from "./calories";

describe("stepCalories", () => {
  it("estimates 10,000 steps for a 175 cm, 75 kg person at about 270 kcal", () => {
    expect(stepCalories(10_000, 175, 75)).toBeCloseTo(272.3, 1);
  });
  it("is zero with no steps and grows with height and weight", () => {
    expect(stepCalories(0, 175, 75)).toBe(0);
    expect(stepCalories(8000, 190, 75)).toBeGreaterThan(stepCalories(8000, 160, 75));
    expect(stepCalories(8000, 175, 90)).toBeGreaterThan(stepCalories(8000, 175, 70));
  });
});
