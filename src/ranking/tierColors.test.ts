import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, readableOn, TIER_COLORS } from "./tierColors";

const tokens = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");
const token = (name: string) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1].toLowerCase();
const LIGHT_SURFACE = "#ffffff";
const DARK_SURFACE = "#0e151f";

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});

describe("TIER_COLORS", () => {
  it("mirrors the --rank-* tokens", () => {
    for (const [id, hex] of Object.entries(TIER_COLORS)) expect(token(`rank-${id}`), id).toBe(hex);
  });

  it("are all readable as large text on the dark surface", () => {
    expect(token("surface")).toBe(LIGHT_SURFACE);
    for (const [id, hex] of Object.entries(TIER_COLORS)) expect(readableOn(hex, DARK_SURFACE), id).toBe(true);
  });

  it("keeps neighbouring tiers apart in lightness", () => {
    const hexes = Object.values(TIER_COLORS);
    for (let i = 1; i < hexes.length; i++) expect(contrast(hexes[i - 1], hexes[i]), `${hexes[i - 1]} / ${hexes[i]}`).toBeGreaterThan(1.3);
  });
});
