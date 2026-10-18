import { describe, expect, it } from "vitest";
import { formatHeight, fromKg, parseHeight, toKg } from "./units";

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

describe("height", () => {
  it("formats by unit", () => {
    expect(formatHeight(175, "kg")).toBe("175 cm");
    expect(formatHeight(175.3, "kg")).toBe("175.3 cm");
    expect(formatHeight(175.26, "lb")).toBe("5 ft 9 in");
  });
  it("parses metric", () => {
    expect(parseHeight("175", "kg")).toBe(175);
    expect(parseHeight("175 cm", "kg")).toBe(175);
    expect(parseHeight("1,75", "kg")).toBe(175);
  });
  it("parses feet and inches", () => {
    expect(parseHeight("5 ft 9 in", "lb")).toBe(175.3);
    expect(parseHeight("5'9", "lb")).toBe(175.3);
    expect(parseHeight("69", "lb")).toBe(175.3);
    expect(parseHeight("6", "lb")).toBe(182.9);
    expect(parseHeight("175 cm", "lb")).toBe(175);
    expect(parseHeight("5'9", "kg")).toBe(175.3);
  });
  it("rejects nonsense and out-of-range values", () => {
    for (const t of ["", "tall", "50", "300", "0"]) expect(parseHeight(t, "kg")).toBeNull();
    expect(parseHeight("12", "lb")).toBeNull();
  });
});
