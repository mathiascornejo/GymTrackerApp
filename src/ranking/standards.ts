// Strength standards: bodyweight multiples of estimated 1RM needed to REACH each tier above Wood.
// Wood is the starting tier (any logged lift). Each array is [Bronze, Silver, Gold, Platinum, Diamond, Master, Olympian].
//
// UNVERIFIED: every number below is a placeholder written for this app, not taken from a published table.
//   source: author's rough estimate of common strength-standard shapes
//   confidence: low
// Replace them from a source you trust, or edit them in Settings (stored per user, applied on top of this file).
// Female values are the male values times `femaleFactor`, also UNVERIFIED.

export const TIERS = ["Wood", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Olympian"] as const;
export type Tier = (typeof TIERS)[number];

/** external: weight as logged. bodyweight_plus: bodyweight + added load. assisted: bodyweight - assistance. */
export type LoadModel = "external" | "bodyweight_plus" | "assisted";

export type RankingLift = {
  ref: string;
  /** Dataset primary muscle this lift ranks. */
  muscle: string;
  load: LoadModel;
  male: [number, number, number, number, number, number, number];
  femaleFactor: number;
};

const UP = 0.6; // UNVERIFIED
const LOW = 0.75; // UNVERIFIED
const MID = 0.65; // UNVERIFIED

export const RANKING_LIFTS: RankingLift[] = [
  { ref: "ds:Barbell_Bench_Press_-_Medium_Grip", muscle: "chest", load: "external", male: [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.1], femaleFactor: UP },
  { ref: "ds:Dumbbell_Bench_Press", muscle: "chest", load: "external", male: [0.2, 0.3, 0.4, 0.5, 0.62, 0.75, 0.9], femaleFactor: UP },
  { ref: "ds:Standing_Military_Press", muscle: "shoulders", load: "external", male: [0.35, 0.5, 0.65, 0.8, 1.0, 1.2, 1.4], femaleFactor: UP },
  { ref: "ds:Seated_Dumbbell_Press", muscle: "shoulders", load: "external", male: [0.15, 0.22, 0.3, 0.38, 0.47, 0.56, 0.68], femaleFactor: UP },
  { ref: "ds:Close-Grip_Barbell_Bench_Press", muscle: "triceps", load: "external", male: [0.45, 0.65, 0.85, 1.1, 1.3, 1.55, 1.85], femaleFactor: UP },
  { ref: "ds:Dips_-_Triceps_Version", muscle: "triceps", load: "bodyweight_plus", male: [1.1, 1.35, 1.6, 1.9, 2.2, 2.6, 3.0], femaleFactor: UP },
  { ref: "ds:Barbell_Curl", muscle: "biceps", load: "external", male: [0.25, 0.4, 0.55, 0.7, 0.85, 1.0, 1.2], femaleFactor: UP },
  { ref: "ds:Dumbbell_Bicep_Curl", muscle: "biceps", load: "external", male: [0.1, 0.17, 0.24, 0.31, 0.38, 0.46, 0.55], femaleFactor: UP },
  { ref: "ds:Pullups", muscle: "lats", load: "bodyweight_plus", male: [1.0, 1.2, 1.4, 1.65, 1.9, 2.2, 2.5], femaleFactor: UP },
  { ref: "ds:Chin-Up", muscle: "lats", load: "bodyweight_plus", male: [1.05, 1.25, 1.5, 1.75, 2.0, 2.3, 2.6], femaleFactor: UP },
  { ref: "ds:Wide-Grip_Lat_Pulldown", muscle: "lats", load: "external", male: [0.5, 0.7, 0.9, 1.1, 1.35, 1.6, 1.85], femaleFactor: UP },
  { ref: "ds:Bent_Over_Barbell_Row", muscle: "middle back", load: "external", male: [0.4, 0.6, 0.8, 1.0, 1.25, 1.5, 1.75], femaleFactor: UP },
  { ref: "ds:One-Arm_Dumbbell_Row", muscle: "middle back", load: "external", male: [0.15, 0.25, 0.35, 0.45, 0.58, 0.72, 0.86], femaleFactor: UP },
  { ref: "ds:Barbell_Deadlift", muscle: "lower back", load: "external", male: [0.75, 1.15, 1.5, 1.9, 2.4, 2.9, 3.4], femaleFactor: LOW },
  { ref: "ds:Hyperextensions_Back_Extensions", muscle: "lower back", load: "bodyweight_plus", male: [1.0, 1.15, 1.3, 1.5, 1.7, 1.95, 2.2], femaleFactor: LOW },
  { ref: "ds:Barbell_Shrug", muscle: "traps", load: "external", male: [0.5, 0.8, 1.1, 1.45, 1.8, 2.2, 2.6], femaleFactor: MID },
  { ref: "ds:Barbell_Squat", muscle: "quadriceps", load: "external", male: [0.6, 0.9, 1.25, 1.6, 2.0, 2.4, 2.8], femaleFactor: LOW },
  { ref: "ds:Leg_Press", muscle: "quadriceps", load: "external", male: [1.0, 1.6, 2.2, 2.9, 3.6, 4.4, 5.2], femaleFactor: LOW },
  { ref: "ds:Romanian_Deadlift", muscle: "hamstrings", load: "external", male: [0.5, 0.75, 1.0, 1.3, 1.6, 1.95, 2.3], femaleFactor: LOW },
  { ref: "ds:Stiff-Legged_Barbell_Deadlift", muscle: "hamstrings", load: "external", male: [0.45, 0.7, 0.95, 1.2, 1.5, 1.85, 2.2], femaleFactor: LOW },
  { ref: "ds:Barbell_Hip_Thrust", muscle: "glutes", load: "external", male: [0.6, 1.0, 1.4, 1.85, 2.3, 2.8, 3.3], femaleFactor: LOW },
  { ref: "ds:Standing_Calf_Raises", muscle: "calves", load: "external", male: [0.7, 1.0, 1.4, 1.8, 2.3, 2.8, 3.4], femaleFactor: LOW },
  { ref: "ds:Seated_Calf_Raise", muscle: "calves", load: "external", male: [0.4, 0.65, 0.9, 1.2, 1.5, 1.85, 2.2], femaleFactor: LOW },
  { ref: "ds:Cable_Crunch", muscle: "abdominals", load: "external", male: [0.35, 0.55, 0.75, 0.95, 1.2, 1.45, 1.7], femaleFactor: MID },
  { ref: "ds:Seated_Palms-Down_Barbell_Wrist_Curl", muscle: "forearms", load: "external", male: [0.15, 0.25, 0.35, 0.45, 0.58, 0.72, 0.88], femaleFactor: UP },
  { ref: "ds:Seated_Palm-Up_Barbell_Wrist_Curl", muscle: "forearms", load: "external", male: [0.2, 0.32, 0.45, 0.58, 0.72, 0.88, 1.05], femaleFactor: UP },
  { ref: "ds:Thigh_Abductor", muscle: "abductors", load: "external", male: [0.5, 0.8, 1.1, 1.45, 1.8, 2.2, 2.6], femaleFactor: LOW },
  { ref: "ds:Thigh_Adductor", muscle: "adductors", load: "external", male: [0.5, 0.8, 1.1, 1.4, 1.75, 2.1, 2.5], femaleFactor: LOW },
];

/** Above this multiple of bodyweight an estimated 1RM is treated as a probable typo until the user confirms it. */
export const IMPLAUSIBLE_RATIO = 5;

export const MUSCLES = [...new Set(RANKING_LIFTS.map((l) => l.muscle))];

export type Table = "male" | "female";
export type Overrides = Record<string, number[]>;

/** Thresholds for one lift: a user override wins, otherwise the file's values for the chosen table. */
export function thresholds(lift: RankingLift, table: Table, overrides: Overrides = {}): number[] {
  const o = overrides[lift.ref];
  if (o && o.length === 7 && o.every((n) => Number.isFinite(n) && n > 0)) return o;
  return table === "female" ? lift.male.map((n) => Math.round(n * lift.femaleFactor * 1000) / 1000) : [...lift.male];
}
