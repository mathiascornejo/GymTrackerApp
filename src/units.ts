export type Unit = "kg" | "lb";

const LB_PER_KG = 2.20462262185;

/** Storage is numeric(8,4), so round to 4 places on the way in. */
export const toKg = (value: number, unit: Unit) =>
  Math.round((unit === "kg" ? value : value / LB_PER_KG) * 1e4) / 1e4;

/** Display rounds to 0.1; the stored value is never rounded this way. */
export const fromKg = (kg: number, unit: Unit) =>
  Math.round((unit === "kg" ? kg : kg * LB_PER_KG) * 10) / 10;

const CM_PER_IN = 2.54;

/** The range the profile accepts (matches the column check). */
export const HEIGHT_CM = { min: 100, max: 250 };

/** Height follows the weight unit: kilograms show centimetres, pounds show feet and inches. */
export function formatHeight(cm: number, unit: Unit): string {
  if (unit === "kg") return `${Math.round(cm * 10) / 10} cm`;
  const inches = Math.round(cm / CM_PER_IN);
  return `${Math.floor(inches / 12)} ft ${inches % 12} in`;
}

/** Reads what a person types: "175", "1.75", "5 ft 9", "5'9", "69", or "175 cm" in either unit. Null when unreadable or out of range. */
export function parseHeight(text: string, unit: Unit): number | null {
  const nums = text.replace(",", ".").match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (!nums.length) return null;
  let cm: number;
  if (/cm/i.test(text) || (unit === "kg" && !/['′]|ft|feet/i.test(text))) cm = nums[0] < 3 ? nums[0] * 100 : nums[0];
  else if (nums.length > 1 || /['′]|ft|feet/i.test(text) || nums[0] <= 9) cm = (nums[0] * 12 + (nums[1] ?? 0)) * CM_PER_IN;
  else cm = nums[0] * CM_PER_IN;
  cm = Math.round(cm * 10) / 10;
  return cm >= HEIGHT_CM.min && cm <= HEIGHT_CM.max ? cm : null;
}
