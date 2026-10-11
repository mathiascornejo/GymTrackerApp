import type { Routine } from "../routines/model";

export type PlanItem = { itemId: string; ref: string; repMin: number; repMax: number };
export type PlanBlock = {
  /** Block id for routine blocks, `adhoc:<ref>` for exercises added on the day. */
  key: string;
  blockId: string | null;
  kind: "single" | "superset" | "circuit";
  rounds: number;
  restS: number;
  transitionRestS: number;
  items: PlanItem[];
  group: "main" | "accessory" | "optional";
  /** Optional bank blocks only: "n of target this week". */
  weeklyTarget: number | null;
};

/** Today's blocks in routine order, then bank blocks scheduled today, then flexible-frequency ones as optional. */
export function buildPlan(routine: Routine | null, weekday: number | null, adhoc: string[], defaultRestS: number): PlanBlock[] {
  const out: PlanBlock[] = [];
  const toPlan = (b: Routine["bank"][number], group: PlanBlock["group"]): PlanBlock => ({
    key: b.id,
    blockId: b.id,
    kind: b.kind,
    rounds: b.sets,
    restS: b.restS,
    transitionRestS: b.transitionRestS,
    items: b.items.map((i) => ({ itemId: i.id, ref: i.ref, repMin: i.repMin, repMax: i.repMax })),
    group,
    weeklyTarget: group === "optional" ? b.weeklyTarget : null,
  });

  if (routine && weekday !== null) {
    routine.days.find((d) => d.weekday === weekday)?.blocks.forEach((b) => out.push(toPlan(b, "main")));
  }
  adhoc.forEach((ref) =>
    out.push({
      key: `adhoc:${ref}`,
      blockId: null,
      kind: "single",
      rounds: 3,
      restS: defaultRestS,
      transitionRestS: 0,
      items: [{ itemId: ref, ref, repMin: 8, repMax: 12 }],
      group: "main",
      weeklyTarget: null,
    }),
  );
  if (routine && weekday !== null) {
    routine.bank.filter((b) => b.weekdays?.includes(weekday)).forEach((b) => out.push(toPlan(b, "accessory")));
    routine.bank.filter((b) => b.weekdays === null && b.weeklyTarget).forEach((b) => out.push(toPlan(b, "optional")));
  }
  return out;
}
