import type { Exercise } from "./types";

// Bump deliberately: exercise_ref values in history are `ds:<id>`, so a new SHA needs an old-id to new-id check first.
export const DATASET_SHA = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
const IMAGE_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${DATASET_SHA}/exercises`;

type Raw = {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  category: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
};

export const toExercise = (r: Raw): Exercise => ({
  ref: `ds:${r.id}`,
  name: r.name,
  primary: r.primaryMuscles,
  secondary: r.secondaryMuscles,
  equipment: r.equipment,
  force: r.force,
  mechanic: r.mechanic,
  level: r.level,
  category: r.category,
  instructions: r.instructions,
  images: r.images.map((p) => `${IMAGE_BASE}/${p}`),
  custom: false,
});

/** The dataset is about 1 MB, so it loads as its own chunk when the Exercises tab first needs it. */
export async function loadDataset(): Promise<Exercise[]> {
  const raw = (await import("./dataset.json")).default as Raw[];
  return raw.map(toExercise);
}
