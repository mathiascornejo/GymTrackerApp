/** Walking energy above resting, in kcal: distance (steps x stride) x bodyweight x a per-kg-per-km cost. A rough estimate, good to about 25%. */
const STRIDE_PER_HEIGHT = 0.415; // UNVERIFIED: the usual walking stride as a share of height
const KCAL_PER_KG_KM = 0.5; // UNVERIFIED: net cost of walking at an easy pace

export const stepCalories = (steps: number, heightCm: number, weightKg: number) =>
  ((steps * STRIDE_PER_HEIGHT * heightCm) / 100 / 1000) * weightKg * KCAL_PER_KG_KM;
