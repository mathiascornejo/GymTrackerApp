export type Unit = "kg" | "lb";

const LB_PER_KG = 2.20462262185;

/** Storage is numeric(8,4), so round to 4 places on the way in. */
export const toKg = (value: number, unit: Unit) =>
  Math.round((unit === "kg" ? value : value / LB_PER_KG) * 1e4) / 1e4;

/** Display rounds to 0.1; the stored value is never rounded this way. */
export const fromKg = (kg: number, unit: Unit) =>
  Math.round((unit === "kg" ? kg : kg * LB_PER_KG) * 10) / 10;
