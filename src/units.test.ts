import { describe, expect, it } from "vitest";
import { fromKg, toKg } from "./units";

describe("units", () => {
  it("passes kg through", () => {
    expect(toKg(82.5, "kg")).toBe(82.5);
    expect(fromKg(82.5, "kg")).toBe(82.5);
  });
  it("converts lb to kg at 4 decimals", () => {
    expect(toKg(135, "lb")).toBe(61.235);
  });
  it("displays kg as lb to 0.1", () => {
    expect(fromKg(61.235, "lb")).toBe(135);
    expect(fromKg(100, "lb")).toBe(220.5);
  });
  it("round-trips plate weights entered in lb", () => {
    for (const lb of [45, 95, 135, 185, 225, 315]) expect(fromKg(toKg(lb, "lb"), "lb")).toBe(lb);
  });
});
