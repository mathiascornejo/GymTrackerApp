import { describe, expect, it } from "vitest";
import { isCardio, parseTime } from "./cardio";

describe("cardio", () => {
  it("parses typed times", () => {
    expect(parseTime("12:30")).toBe(750);
    expect(parseTime("20")).toBe(1200);
    expect(parseTime(" 1:05 ")).toBe(65);
    expect(parseTime("0:90")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
  it("detects cardio by category", () => {
    expect(isCardio({ category: "cardio" })).toBe(true);
    expect(isCardio({ category: "chest" })).toBe(false);
    expect(isCardio(undefined)).toBe(false);
  });
});
