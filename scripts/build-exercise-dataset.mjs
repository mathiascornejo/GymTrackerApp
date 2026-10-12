// Converts hasaneyldrm/exercises-dataset (data/exercises.json) into src/exercises/dataset.json.
// One-off migration. Usage: node scripts/build-exercise-dataset.mjs <new exercises.json> <old free-exercise-db dataset.json>
// Keeps old free-exercise-db ids where an exercise is the same one, so stored `ds:<id>` refs and
// the ranking standards keep working. Everything else gets the new numeric id.
import { readFileSync, writeFileSync } from "node:fs";

const [src, oldSrc] = process.argv.slice(2);
if (!src || !oldSrc) throw new Error("pass the new exercises.json and the old dataset.json");
const out = new URL("../src/exercises/dataset.json", import.meta.url);
const raw = JSON.parse(readFileSync(src, "utf8"));
const old = JSON.parse(readFileSync(oldSrc, "utf8"));

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const fix = (s) => s.replace(/в°/g, "°"); // mojibake in some upstream names
const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Old id (as used by ranking standards and history) to the closest new exercise name. UNVERIFIED: judgement calls.
const OVERRIDES = {
  "Barbell_Bench_Press_-_Medium_Grip": "barbell bench press",
  "Close-Grip_Barbell_Bench_Press": "barbell close-grip bench press",
  "Standing_Military_Press": "barbell standing wide military press",
  "Dips_-_Triceps_Version": "triceps dip",
  "Pullups": "pull up (neutral grip)",
  "Wide-Grip_Lat_Pulldown": "cable lat pulldown full range of motion",
  "Bent_Over_Barbell_Row": "barbell bent over row",
  "One-Arm_Dumbbell_Row": "dumbbell one arm bent over row",
  "Hyperextensions_Back_Extensions": "hyperextension",
  "Barbell_Squat": "barbell high bar squat",
  "Romanian_Deadlift": "barbell romanian deadlift",
  "Standing_Calf_Raises": "barbell standing calf raise",
  "Seated_Calf_Raise": "dumbbell seated calf raise",
  "Cable_Crunch": "cable kneeling crunch",
  "Seated_Palm-Up_Barbell_Wrist_Curl": "barbell palms up wrist curl over a bench",
  "Seated_Palms-Down_Barbell_Wrist_Curl": "barbell palms down wrist curl over a bench",
  "Dumbbell_Bicep_Curl": "dumbbell seated bicep curl",
  "Thigh_Adductor": "lever seated hip adduction",
  "Thigh_Abductor": "lever seated hip abduction",
  "Leg_Press": "sled 45 leg press",
  "Barbell_Hip_Thrust": "barbell glute bridge two legs on bench (male)",
  "Seated_Dumbbell_Press": "dumbbell seated shoulder press",
  "Stiff-Legged_Barbell_Deadlift": "barbell straight leg deadlift",
  "Chin-Up": "chin up",
};

// Upstream `target`, `muscle_group` and `secondary_muscles` use different labels; fold them into the app's 17 groups.
const MUSCLE = {
  abs: "abdominals", abdominals: "abdominals", core: "abdominals", obliques: "abdominals", "lower abs": "abdominals",
  pectorals: "chest", chest: "chest", "upper chest": "chest", "serratus anterior": "chest",
  delts: "shoulders", deltoids: "shoulders", "rear deltoids": "shoulders", shoulders: "shoulders", "rotator cuff": "shoulders",
  "upper back": "middle back", rhomboids: "middle back", back: "middle back",
  lats: "lats", "latissimus dorsi": "lats",
  spine: "lower back", "lower back": "lower back",
  quads: "quadriceps", quadriceps: "quadriceps", "hip flexors": "quadriceps",
  calves: "calves", soleus: "calves", ankles: "calves", "ankle stabilizers": "calves", feet: "calves", shins: "calves",
  forearms: "forearms", wrists: "forearms", "wrist flexors": "forearms", "wrist extensors": "forearms", hands: "forearms", "grip muscles": "forearms",
  biceps: "biceps", brachialis: "biceps", triceps: "triceps",
  hamstrings: "hamstrings", glutes: "glutes", traps: "traps", trapezius: "traps", "levator scapulae": "traps",
  adductors: "adductors", "inner thighs": "adductors", groin: "adductors", abductors: "abductors",
  sternocleidomastoid: "neck",
};
const muscles = (xs) => [...new Set(xs.map((m) => MUSCLE[m]).filter(Boolean))];

const rawByName = new Map();
for (const r of raw) if (!rawByName.has(norm(fix(r.name)))) rawByName.set(norm(fix(r.name)), r);
const claimed = new Map(); // new id to old id
for (const o of old) {
  const hit = rawByName.get(norm(OVERRIDES[o.id] ?? o.name));
  if (hit && !claimed.has(hit.id)) claimed.set(hit.id, o.id);
}
for (const [oldId, name] of Object.entries(OVERRIDES))
  if (![...claimed.values()].includes(oldId)) console.warn("unresolved override:", oldId, "->", name);

const data = raw.map((r) => {
  const primary = muscles([r.target]);
  return {
    id: claimed.get(r.id) ?? r.id,
    name: title(fix(r.name)),
    force: null,
    level: null,
    mechanic: null,
    equipment: r.equipment || null,
    primaryMuscles: primary,
    secondaryMuscles: muscles(r.secondary_muscles ?? []).filter((m) => !primary.includes(m)),
    instructions: r.instruction_steps?.en ?? [r.instructions?.en].filter(Boolean),
    category: r.body_part || null,
    images: [r.gif_url],
  };
});
writeFileSync(out, JSON.stringify(data));
console.log(`${data.length} exercises, ${claimed.size} kept an old id`);
