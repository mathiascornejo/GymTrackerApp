import { describe, expect, it } from "vitest";
import { addBlock, newBlock, newRoutine, updateBlock } from "../routines/model";
import { buildPlan } from "./plan";

describe("buildPlan", () => {
  const base = () => {
    let r = newRoutine("R", true);
    r = addBlock(r, { day: 1 }, newBlock("ds:Bench", 90));
    r = addBlock(r, { day: 2 }, newBlock("ds:Squat", 120));
    r = addBlock(r, "bank", { ...newBlock("ds:Calf", 60), weekdays: [1, 3] });
    r = addBlock(r, "bank", { ...newBlock("ds:Neck", 60), weekdays: null, weeklyTarget: 2 });
    return r;
  };

  it("groups main, scheduled accessories and optional blocks for the day", () => {
    const plan = buildPlan(base(), 1, [], 90);
    expect(plan.map((p) => [p.items[0].ref, p.group])).toEqual([
      ["ds:Bench", "main"],
      ["ds:Calf", "accessory"],
      ["ds:Neck", "optional"],
    ]);
    expect(plan[2].weeklyTarget).toBe(2);
  });

  it("omits accessories not scheduled for the day", () => {
    expect(buildPlan(base(), 2, [], 90).map((p) => p.items[0].ref)).toEqual(["ds:Squat", "ds:Neck"]);
  });

  it("puts ad hoc exercises after the main blocks with the default rest", () => {
    const plan = buildPlan(base(), 1, ["ds:Row"], 75);
    expect(plan[1]).toMatchObject({ key: "adhoc:ds:Row", blockId: null, group: "main", restS: 75, rounds: 3 });
  });

  it("is only ad hoc blocks for a quick session", () => {
    expect(buildPlan(null, null, ["ds:Row"], 90)).toHaveLength(1);
  });

  it("carries rounds and rest from the block", () => {
    let r = base();
    const id = r.days[1].blocks[0].id;
    r = updateBlock(r, id, { sets: 5, restS: 150 });
    expect(buildPlan(r, 1, [], 90)[0]).toMatchObject({ rounds: 5, restS: 150 });
  });
});
