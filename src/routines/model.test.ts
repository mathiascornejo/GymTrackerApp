import { beforeEach, describe, expect, it } from "vitest";
import {
  addBlock, addItem, containerBlocks, duplicate, exportRoutine, importRoutine, link, locate, moveBlock, newBlock,
  newRoutine, pairNote, removeItem, extractItem, routineStats, unlink, updateItem, weeklySets, type Routine,
} from "./model";

let r: Routine;
const mon = { day: 1 };
beforeEach(() => {
  r = newRoutine("Test", true);
});

const ids = (x: Routine, t: Parameters<typeof containerBlocks>[1]) => containerBlocks(x, t).map((b) => b.items[0].ref);

describe("blocks", () => {
  it("adds, reorders and moves between days", () => {
    r = addBlock(r, mon, newBlock("ds:A", 90));
    r = addBlock(r, mon, newBlock("ds:B", 90));
    r = addBlock(r, mon, newBlock("ds:C", 90), 0);
    expect(ids(r, mon)).toEqual(["ds:C", "ds:A", "ds:B"]);
    const a = containerBlocks(r, mon)[1].id;
    r = moveBlock(r, a, { day: 3 });
    expect(ids(r, mon)).toEqual(["ds:C", "ds:B"]);
    expect(ids(r, { day: 3 })).toEqual(["ds:A"]);
  });

  it("gives bank blocks a daily schedule and clears it when they leave the bank", () => {
    r = addBlock(r, "bank", newBlock("ds:Calf", 60));
    expect(r.bank[0].weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    r = moveBlock(r, r.bank[0].id, mon);
    expect(containerBlocks(r, mon)[0].weekdays).toBeNull();
  });
});

describe("supersets", () => {
  beforeEach(() => {
    r = addBlock(r, mon, newBlock("ds:A", 90));
    r = addBlock(r, mon, newBlock("ds:B", 90));
    r = addBlock(r, mon, newBlock("ds:C", 90));
  });

  it("links two blocks into a superset and a third makes a circuit", () => {
    const [a, b, c] = containerBlocks(r, mon).map((x) => x.id);
    r = link(r, [b, a]);
    expect(containerBlocks(r, mon)).toHaveLength(2);
    expect(containerBlocks(r, mon)[0]).toMatchObject({ kind: "superset" });
    expect(containerBlocks(r, mon)[0].items.map((i) => i.ref)).toEqual(["ds:A", "ds:B"]);
    r = link(r, [a, c]);
    expect(containerBlocks(r, mon)[0]).toMatchObject({ kind: "circuit" });
    expect(containerBlocks(r, mon)).toHaveLength(1);
  });

  it("unlinks back to singles that keep sets and rest", () => {
    const [a, b] = containerBlocks(r, mon).map((x) => x.id);
    r = link(r, [a, b]);
    r = unlink(r, a);
    expect(containerBlocks(r, mon).map((x) => x.kind)).toEqual(["single", "single", "single"]);
    expect(containerBlocks(r, mon)[0].sets).toBe(3);
  });

  it("removing an item shrinks the block and removing the last one deletes it", () => {
    const [a, b] = containerBlocks(r, mon).map((x) => x.id);
    r = link(r, [a, b]);
    const itemB = containerBlocks(r, mon)[0].items[1].id;
    r = removeItem(r, a, itemB);
    expect(containerBlocks(r, mon)[0].kind).toBe("single");
    r = removeItem(r, a, containerBlocks(r, mon)[0].items[0].id);
    expect(locate(r, a)).toBeNull();
  });

  it("addItem turns a single into a superset", () => {
    r = addItem(r, containerBlocks(r, mon)[0].id, "ds:Z");
    expect(containerBlocks(r, mon)[0].kind).toBe("superset");
  });
});

describe("rep range", () => {
  it("keeps repMin <= repMax from either side", () => {
    r = addBlock(r, mon, newBlock("ds:A", 90));
    const b = containerBlocks(r, mon)[0];
    const id = b.items[0].id;
    r = updateItem(r, b.id, id, { repMin: 15 });
    expect(containerBlocks(r, mon)[0].items[0]).toMatchObject({ repMin: 15, repMax: 15 });
    r = updateItem(r, b.id, id, { repMax: 10 });
    expect(containerBlocks(r, mon)[0].items[0]).toMatchObject({ repMin: 10, repMax: 10 });
    r = updateItem(r, b.id, id, { repMin: 0 });
    expect(containerBlocks(r, mon)[0].items[0].repMin).toBe(1);
  });
});

describe("weeklySets", () => {
  it("counts sets per primary muscle, bank blocks per scheduled day", () => {
    r = addBlock(r, mon, newBlock("ds:Bench", 90));
    r = addBlock(r, { day: 4 }, newBlock("ds:Bench", 90));
    r = addBlock(r, "bank", { ...newBlock("ds:Calf", 60), sets: 2, weekdays: [1, 3, 5] });
    const out = weeklySets(r, (ref) => (ref === "ds:Bench" ? ["chest"] : ["calves"]));
    expect(out).toEqual({ chest: 6, calves: 6 });
  });

  it("counts a weekly-target bank block by its target", () => {
    r = addBlock(r, "bank", { ...newBlock("ds:Neck", 60), weekdays: null, weeklyTarget: 2 });
    expect(weeklySets(r, () => ["neck"])).toEqual({ neck: 6 });
  });
});

describe("extractItem", () => {
  it("moves one exercise out of a superset into its own block on another day", () => {
    let x = addBlock(r, mon, newBlock("ds:A", 90));
    const b = containerBlocks(x, mon)[0];
    x = addItem(x, b.id, "ds:B");
    const item = containerBlocks(x, mon)[0].items[1];
    x = extractItem(x, b.id, item.id, { day: 3 });
    expect(containerBlocks(x, mon)[0].items.map((i) => i.ref)).toEqual(["ds:A"]);
    expect(containerBlocks(x, mon)[0].kind).toBe("single");
    expect(containerBlocks(x, { day: 3 }).map((blk) => blk.items[0].ref)).toEqual(["ds:B"]);
  });
  it("leaves a single-exercise block alone", () => {
    const x = addBlock(r, mon, newBlock("ds:A", 90));
    const b = containerBlocks(x, mon)[0];
    expect(extractItem(x, b.id, b.items[0].id, { day: 2 })).toBe(x);
  });
});

describe("routineStats", () => {
  it("counts training days, distinct exercises and weekly sets", () => {
    let r = newRoutine("R", true);
    r = addBlock(r, { day: 1 }, newBlock("ds:A", 90));
    r = addBlock(r, { day: 3 }, newBlock("ds:A", 90));
    r = addBlock(r, "bank", { ...newBlock("ds:B", 90), weekdays: [1, 5] });
    expect(routineStats(r)).toEqual({ trainingDays: 3, exercises: 2, weeklySets: 2 * 3 + 2 * 3 });
  });
});

describe("pairNote", () => {
  const info = (ref: string) => ({ "ds:P": { force: "push", primary: ["chest"] }, "ds:L": { force: "pull", primary: ["lats"] }, "ds:Q": { force: "push", primary: ["chest"] } })[ref];
  const two = (a: string, b: string) => {
    let x = addBlock(r, mon, newBlock(a, 90));
    x = addItem(x, containerBlocks(x, mon)[0].id, b);
    return containerBlocks(x, mon)[0];
  };
  it("labels push/pull pairs and same-muscle pairs", () => {
    expect(pairNote(two("ds:P", "ds:L"), info)).toBe("push-pull");
    expect(pairNote(two("ds:P", "ds:Q"), info)).toBe("same-muscle");
    expect(pairNote(newBlock("ds:P", 90), info)).toBeNull();
  });
});

describe("duplicate", () => {
  it("copies content with new ids and never inherits active", () => {
    r = addBlock(r, mon, newBlock("ds:A", 90));
    const d = duplicate(r, "Copy");
    expect(d.isActive).toBe(false);
    expect(d.id).not.toBe(r.id);
    expect(containerBlocks(d, mon)[0].id).not.toBe(containerBlocks(r, mon)[0].id);
    expect(ids(d, mon)).toEqual(["ds:A"]);
  });
});

describe("import and export", () => {
  const exists = (ref: string) => ref.startsWith("ds:");
  it("round-trips a routine", () => {
    r = addBlock(r, mon, newBlock("ds:A", 90));
    r = addItem(r, containerBlocks(r, mon)[0].id, "ds:B");
    r = addBlock(r, "bank", newBlock("ds:Calf", 60));
    const back = importRoutine(JSON.parse(JSON.stringify(exportRoutine(r))), exists);
    expect("routine" in back).toBe(true);
    if ("routine" in back) {
      expect(exportRoutine(back.routine)).toEqual(exportRoutine(r));
      expect(back.routine.id).not.toBe(r.id);
    }
  });

  it("reports every problem in a bad file", () => {
    const bad = {
      format: "tempered-routine", version: 1, name: "X",
      days: [{ weekday: 9, label: "", blocks: [] }, { weekday: 1, label: "", blocks: [{ sets: 0, restS: 90, items: [{ ref: "ds:Nope2", repMin: 12, repMax: 8 }] }] }],
      bank: [],
    };
    const out = importRoutine(bad, (ref) => ref !== "ds:Nope2");
    expect("errors" in out && out.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects files that are not routine exports", () => {
    expect(importRoutine({ hello: 1 }, exists)).toHaveProperty("errors");
    expect(importRoutine(null, exists)).toHaveProperty("errors");
  });
});
