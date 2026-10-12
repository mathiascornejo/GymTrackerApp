import type { Exercise } from "./types";

// Bump deliberately: exercise_ref values in history are `ds:<id>`, so a new SHA needs an old-id to new-id check first.
// Ids are the old free-exercise-db ids where an exercise carried over (see scripts/build-exercise-dataset.mjs), else the upstream numeric id.
export const DATASET_SHA = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
const IMAGE_BASE = `https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@${DATASET_SHA}`;

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
