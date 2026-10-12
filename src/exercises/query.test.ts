import { describe, expect, it } from "vitest";
import { applyFilters, facets, search, toRows } from "./query";
import type { Exercise } from "./types";

const ex = (name: string, over: Partial<Exercise> = {}): Exercise => ({
  ref: `ds:${name}`,
  name,
  primary: ["chest"],
  secondary: [],
  equipment: "barbell",
  force: "push",
  mechanic: "compound",
  level: "beginner",
  category: "strength",
  instructions: [],
  images: [],
  custom: false,
  ...over,
});

const list = [
  ex("Barbell Bench Press"),
  ex("Incline Dumbbell Press", { equipment: "dumbbell", level: "intermediate" }),
  ex("Cable Crunch", { primary: ["abdominals"], equipment: "cable", force: "pull" }),
  ex("Bench Dip", { primary: ["triceps"], equipment: "body only" }),
];

describe("search", () => {
  it("returns everything for an empty query", () => {
    expect(search(list, "  ")).toHaveLength(4);
  });
  it("requires every word and ranks name-prefix matches first", () => {
    expect(search(list, "bench").map((e) => e.name)).toEqual(["Bench Dip", "Barbell Bench Press"]);
    expect(search(list, "bench press").map((e) => e.name)).toEqual(["Barbell Bench Press"]);
  });
  it("matches primary muscle and equipment words", () => {
    expect(search(list, "abdominals").map((e) => e.name)).toEqual(["Cable Crunch"]);
    expect(search(list, "dumbbell").map((e) => e.name)).toEqual(["Incline Dumbbell Press"]);
  });
});

describe("commonness", () => {
  it("puts staple lifts and plain equipment before rarer variants", () => {
    const l = [ex("Bosu Ball Press", { ref: "ds:x", equipment: "bosu ball" }), ex("Dumbbell Fly", { ref: "ds:y", equipment: "dumbbell" }), ex("Barbell Bench Press", { ref: "ds:Barbell_Bench_Press_-_Medium_Grip" })];
    expect(search(l, "press").map((e) => e.name)).toEqual(["Barbell Bench Press", "Bosu Ball Press"]);
    expect(toRows(l, false).filter((r) => r.type === "item").map((r) => (r as { exercise: Exercise }).exercise.name)).toEqual(["Barbell Bench Press", "Dumbbell Fly", "Bosu Ball Press"]);
  });
});

describe("applyFilters", () => {
  it("combines filters with AND", () => {
    expect(applyFilters(list, { muscle: "chest", equipment: "dumbbell" }).map((e) => e.name)).toEqual(["Incline Dumbbell Press"]);
  });
  it("matches primary muscles only", () => {
    expect(applyFilters([ex("Row", { primary: ["lats"], secondary: ["biceps"] })], { muscle: "biceps" })).toHaveLength(0);
  });
});

describe("toRows", () => {
  it("groups by primary muscle with headers when browsing", () => {
    const rows = toRows(list, false);
    expect(rows.filter((r) => r.type === "header").map((r) => (r.type === "header" ? r.label : ""))).toEqual(["abdominals", "chest", "triceps"]);
    expect(rows[0]).toEqual({ type: "header", label: "abdominals", count: 1 });
  });
  it("is flat while searching", () => {
    expect(toRows(list, true).every((r) => r.type === "item")).toBe(true);
  });
});

describe("facets", () => {
  it("collects sorted unique values and includes secondary muscles", () => {
    const f = facets([ex("A", { secondary: ["biceps"] }), ex("B", { primary: ["lats"] })]);
    expect(f.muscle).toEqual(["biceps", "chest", "lats"]);
    expect(f.equipment).toEqual(["barbell"]);
  });
});
