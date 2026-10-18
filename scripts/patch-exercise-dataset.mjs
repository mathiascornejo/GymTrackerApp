// Hand fixes for src/exercises/dataset.json: renames, exercises the build filter dropped (taken from the upstream
// dataset, with their GIFs), and exercises upstream does not have (no media). Idempotent. Re-run after regenerating the dataset.
// Usage: node scripts/patch-exercise-dataset.mjs <upstream data/exercises.json at DATASET_SHA>
// Everything below is a judgement call: muscles on added exercises are // UNVERIFIED.
import { readFileSync, writeFileSync } from "node:fs";

const [upstreamPath] = process.argv.slice(2);
if (!upstreamPath) throw new Error("pass the upstream exercises.json");
const file = new URL("../src/exercises/dataset.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
const upstream = new Map(JSON.parse(readFileSync(upstreamPath, "utf8")).map((r) => [r.id, r]));
const byId = new Map(data.map((r) => [r.id, r]));

// Upstream's own names that are garbled, vague or duplicated. Two entries that are the same exercise get "(Variation 2)".
const RENAMES = {
  "Barbell_Hip_Thrust": "Barbell Hip Thrust", // upstream: "Barbell Glute Bridge Two Legs on Bench (Male)"
  "Wide-Grip_Lat_Pulldown": "Cable Lat Pulldown",
  "0007": "Cable Wide-Grip Lat Pulldown",
  "3533": "Bodyweight Squat", // upstream calls it "Quads"; the steps are a bodyweight squat
  "1397": "Bodyweight Standing Calf Raise (Variation 2)", // "Standing Calves"
  "1398": "Standing Calf Stretch",
  "0316": "Dumbbell Incline Bench Press (Variation 2)", // "Incline Breeding"
  "3234": "Dumbbell Fly (Variation 2)", // "Hyght Dumbbell Fly"
  "Dumbbell_Raise": "Dumbbell Lateral Raise (Variation 2)",
  "0377": "Dumbbell Rear Delt Row",
  "2189": "Dumbbell Seated Overhead Triceps Extension",
  "0574": "Barbell Bent Over Row (Variation 2)", // "Lever Bent Over Row" with a barbell
  "0684": "Jog in Place", // "Run (Equipment)"
  "0052": "Barbell JM Press",
  "0084": "Barbell Rollout",
  "0083": "Barbell Rollout From Bench",
  "0103": "Barbell Standing Ab Rollout",
  "2271": "Left Hook (Boxing)",
  "1371": "Barbell Seated Calf Raise (Variation 2)",
  "1731": "Dumbbell Close-Grip Press (Variation 2)",
  "1628": "EZ-Bar Spider Curl (Variation 2)",
  "0577": "Machine Chest Press (Variation 2)",
  "1394": "Smith Machine Reverse Calf Raises (Variation 2)",
};

// Naming conventions: "Smith Machine ...", "Machine ..." (upstream "Lever"), "EZ-Bar ...".
const PREFIXES = [
  [/^Smith (?!Machine)/, "Smith Machine "],
  [/^Lever /, "Machine "],
  [/^Ez[ -]Barbell /, "EZ-Bar "],
  [/^Ez-Bar /, "EZ-Bar "],
];

const renamed = new Set(Object.keys(RENAMES));
for (const id of renamed) if (!byId.has(id)) throw new Error(`rename for unknown id ${id}`);
for (const r of data) {
  if (RENAMES[r.id]) r.name = RENAMES[r.id];
  else for (const [rx, to] of PREFIXES) if (rx.test(r.name)) r.name = r.name.replace(rx, to);
}

// From upstream: same id, upstream GIF and steps; name, equipment and muscles set here.
const FROM_UPSTREAM = [
  { id: "3523", name: "Bodyweight Hip Thrust", equipment: "body weight", primary: ["glutes"], secondary: ["hamstrings", "abdominals"] },
  { id: "3236", name: "Kneeling Band Hip Thrust", equipment: "band", primary: ["glutes"], secondary: ["hamstrings", "quadriceps"] },
  { id: "3013", name: "Glute Bridge", equipment: "body weight", primary: ["glutes"], secondary: ["hamstrings", "abdominals"] },
  { id: "3645", name: "Single Leg Glute Bridge", equipment: "body weight", primary: ["glutes"], secondary: ["hamstrings", "quadriceps"] },
  { id: "0200", name: "Cable Rope Triceps Pushdown", equipment: "cable", primary: ["triceps"], secondary: ["forearms"] },
  { id: "0196", name: "Cable Pull-Through", equipment: "cable", primary: ["glutes"], secondary: ["hamstrings", "lower back"] },
  { id: "0743", name: "Sled Hack Squat", equipment: "sled machine", primary: ["quadriceps"], secondary: ["glutes", "hamstrings", "calves"] },
  { id: "0856", name: "Svend Press", equipment: "weighted", primary: ["chest"], secondary: ["shoulders", "triceps"] },
  { id: "2135", name: "Weighted Plank", equipment: "weighted", primary: ["abdominals"], secondary: ["shoulders", "lower back"] },
  { id: "0818", name: "Cable Parallel-Grip Lat Pulldown", equipment: "cable", primary: ["lats"], secondary: ["biceps", "middle back", "shoulders"] },
  { id: "0673", name: "Machine Reverse-Grip Lat Pulldown", equipment: "leverage machine", primary: ["lats"], secondary: ["biceps", "forearms"] },
  { id: "0979", name: "Band Pallof Press", equipment: "band", primary: ["abdominals"], secondary: ["obliques", "glutes"] },
  { id: "0749", name: "Smith Machine Good Morning", equipment: "smith machine", primary: ["hamstrings"], secondary: ["glutes", "lower back"] },
  { id: "1433", name: "Smith Machine Front Squat", equipment: "smith machine", primary: ["quadriceps"], secondary: ["glutes", "hamstrings", "calves", "abdominals"] },
  { id: "0773", name: "Smith Machine Standing Calf Raise", equipment: "smith machine", primary: ["calves"], secondary: ["hamstrings", "glutes"] },
  { id: "1308", name: "Smith Machine Wide-Grip Bench Press", equipment: "smith machine", primary: ["chest"], secondary: ["triceps", "shoulders"] },
  { id: "1361", name: "Smith Machine Reverse-Grip Bent Over Row", equipment: "smith machine", primary: ["middle back"], secondary: ["biceps", "forearms"] },
  // Cardio machines: no primary muscle, equipment folded into the app's existing "leverage machine".
  { id: "2612", name: "Jump Rope", equipment: "rope", category: "cardio", primary: [], secondary: ["calves", "quadriceps", "hamstrings", "glutes"] },
  { id: "2141", name: "Elliptical Trainer", equipment: "leverage machine", category: "cardio", primary: [], secondary: ["quadriceps", "hamstrings", "glutes", "calves"] },
  { id: "2311", name: "Stair Climber", equipment: "leverage machine", category: "cardio", primary: [], secondary: ["quadriceps", "hamstrings", "glutes", "calves"] },
  { id: "2142", name: "Ski Erg", equipment: "leverage machine", category: "cardio", primary: [], secondary: ["lats", "triceps", "abdominals", "shoulders"] },
];

// Not in upstream: no media, written by hand.
const HAND = [
  {
    id: "Smith_Machine_Hip_Thrust", name: "Smith Machine Hip Thrust", equipment: "smith machine", category: "upper legs", primary: ["glutes"], secondary: ["hamstrings", "quadriceps", "abdominals"],
    instructions: [
      "Set a flat bench behind a Smith machine with the bar low enough to roll over your hips, and wrap the bar in a pad.",
      "Sit on the floor with your upper back against the bench, roll the bar over your hips, and set your feet flat, about hip-width apart, with your knees bent.",
      "Drive through your heels and lift your hips until your torso is level with the floor, squeezing your glutes at the top with your chin tucked.",
      "Lower slowly until your hips almost touch the floor, then repeat. Rotate the bar to rack it when you finish.",
    ],
  },
  {
    id: "Dumbbell_Hip_Thrust", name: "Dumbbell Hip Thrust", equipment: "dumbbell", category: "upper legs", primary: ["glutes"], secondary: ["hamstrings", "quadriceps", "abdominals"],
    instructions: [
      "Sit on the floor with your upper back against a bench and a dumbbell resting across your hips, held with both hands.",
      "Plant your feet flat, about hip-width apart, with your knees bent.",
      "Drive through your heels and lift your hips until your torso is level with the floor, squeezing your glutes at the top.",
      "Lower under control until your hips almost touch the floor, then repeat.",
    ],
  },
  {
    id: "Single_Leg_Hip_Thrust", name: "Single Leg Hip Thrust", equipment: "body weight", category: "upper legs", primary: ["glutes"], secondary: ["hamstrings", "quadriceps", "abdominals"],
    instructions: [
      "Sit on the floor with your upper back against a bench, one foot flat on the floor and the other leg held off the ground.",
      "Drive through the planted heel and lift your hips until your torso is level with the floor, keeping your hips square.",
      "Squeeze your glute at the top, then lower slowly.",
      "Finish your reps, then switch legs.",
    ],
  },
  {
    id: "Machine_Hip_Thrust", name: "Machine Hip Thrust", equipment: "leverage machine", category: "upper legs", primary: ["glutes"], secondary: ["hamstrings", "quadriceps"],
    instructions: [
      "Sit in the machine with your upper back against the pad, the belt or bar across your hips, and your feet flat on the platform.",
      "Drive through your heels and lift your hips until your torso is level with the floor.",
      "Squeeze your glutes at the top, then lower under control and repeat.",
    ],
  },
  {
    id: "Dumbbell_Bulgarian_Split_Squat", name: "Dumbbell Bulgarian Split Squat", equipment: "dumbbell", category: "upper legs", primary: ["quadriceps"], secondary: ["glutes", "hamstrings", "adductors"],
    instructions: [
      "Stand about two feet in front of a bench holding a dumbbell in each hand, and rest the top of one foot on the bench behind you.",
      "Lower straight down until your front thigh is about parallel to the floor, keeping your torso upright and your front knee over your foot.",
      "Drive through your front heel to stand back up.",
      "Finish your reps, then switch legs.",
    ],
  },
  {
    id: "Smith_Machine_Bulgarian_Split_Squat", name: "Smith Machine Bulgarian Split Squat", equipment: "smith machine", category: "upper legs", primary: ["quadriceps"], secondary: ["glutes", "hamstrings", "adductors"],
    instructions: [
      "Place a bench behind you and set the bar at shoulder height. Duck under it with the bar across your upper back and rest the top of one foot on the bench.",
      "Step your front foot far enough forward that your knee stays over your foot as you lower. Unrack the bar.",
      "Lower until your front thigh is about parallel to the floor, then drive through your front heel to stand.",
      "Finish your reps, rack the bar, then switch legs.",
    ],
  },
  {
    id: "Bodyweight_Bulgarian_Split_Squat", name: "Bodyweight Bulgarian Split Squat", equipment: "body weight", category: "upper legs", primary: ["quadriceps"], secondary: ["glutes", "hamstrings", "adductors"],
    instructions: [
      "Stand about two feet in front of a bench and rest the top of one foot on it behind you.",
      "Lower straight down until your front thigh is about parallel to the floor, keeping your torso upright.",
      "Drive through your front heel to stand back up.",
      "Finish your reps, then switch legs.",
    ],
  },
  {
    id: "Smith_Machine_Romanian_Deadlift", name: "Smith Machine Romanian Deadlift", equipment: "smith machine", category: "upper legs", primary: ["hamstrings"], secondary: ["glutes", "lower back"],
    instructions: [
      "Set the bar at about hip height, unrack it with an overhand grip and stand with your feet hip-width apart and your knees slightly bent.",
      "Push your hips back and slide the bar down your thighs, keeping your back flat, until you feel a stretch in your hamstrings.",
      "Drive your hips forward to stand tall, squeezing your glutes at the top.",
    ],
  },
  {
    id: "Box_Jump", name: "Box Jump", equipment: "body weight", category: "upper legs", primary: ["quadriceps"], secondary: ["glutes", "hamstrings", "calves"],
    instructions: [
      "Stand facing a sturdy box with your feet shoulder-width apart.",
      "Dip into a quarter squat, swing your arms back, then jump up and forward and land softly on the box with both feet.",
      "Stand fully upright on the box, then step back down and reset before the next rep.",
    ],
  },
  {
    id: "Nordic_Hamstring_Curl", name: "Nordic Hamstring Curl", equipment: "body weight", category: "upper legs", primary: ["hamstrings"], secondary: ["glutes", "calves"],
    instructions: [
      "Kneel on a pad with your ankles held down by a partner or a fixed anchor, and your body straight from knees to head.",
      "Lower your torso toward the floor as slowly as you can, keeping your hips extended.",
      "Catch yourself with your hands when you can no longer hold, then push off the floor and pull back up with your hamstrings.",
    ],
  },
  {
    id: "Wall_Sit", name: "Wall Sit", equipment: "body weight", category: "upper legs", primary: ["quadriceps"], secondary: ["glutes", "calves"],
    instructions: [
      "Stand with your back against a wall and your feet about two feet in front of you.",
      "Slide down until your thighs are parallel to the floor and your knees are over your ankles.",
      "Hold the position for the target time, keeping your back flat against the wall.",
    ],
  },
  {
    id: "Cable_Glute_Kickback", name: "Cable Glute Kickback", equipment: "cable", category: "upper legs", primary: ["glutes"], secondary: ["hamstrings"],
    instructions: [
      "Attach an ankle strap to a low pulley, strap it to one ankle, and face the stack holding the frame for support.",
      "Lean slightly forward with your core braced and keep the working knee almost straight.",
      "Kick that leg back and up, squeezing your glute at the top without arching your lower back.",
      "Return slowly, finish your reps, then switch legs.",
    ],
  },
  {
    id: "Dumbbell_Chest_Supported_Row", name: "Dumbbell Chest Supported Row", equipment: "dumbbell", category: "back", primary: ["middle back"], secondary: ["lats", "biceps", "shoulders"],
    instructions: [
      "Set a bench to a low incline and lie face down on it with a dumbbell in each hand, arms hanging straight down.",
      "Pull the dumbbells toward your hips, driving your elbows back and squeezing your shoulder blades together.",
      "Pause, then lower the dumbbells slowly until your arms are straight.",
    ],
  },
  {
    id: "Plank", name: "Plank", equipment: "body weight", category: "waist", primary: ["abdominals"], secondary: ["shoulders", "lower back"],
    instructions: [
      "Rest on your forearms and toes with your elbows under your shoulders.",
      "Brace your abs and squeeze your glutes so your body forms a straight line from head to heels.",
      "Hold for the target time without letting your hips sag or rise.",
    ],
  },
  {
    id: "Side_Plank", name: "Side Plank", equipment: "body weight", category: "waist", primary: ["abdominals"], secondary: ["obliques", "shoulders"],
    instructions: [
      "Lie on your side with your elbow under your shoulder and your legs stacked.",
      "Lift your hips so your body forms a straight line from head to feet.",
      "Hold for the target time, then switch sides.",
    ],
  },
  {
    id: "Bicycle_Crunch", name: "Bicycle Crunch", equipment: "body weight", category: "waist", primary: ["abdominals"], secondary: ["obliques"],
    instructions: [
      "Lie on your back with your hands behind your head and your legs raised, knees bent.",
      "Bring one elbow toward the opposite knee while you extend the other leg.",
      "Switch sides in a smooth pedalling motion, keeping your lower back pressed into the floor.",
    ],
  },
  {
    id: "Bird_Dog", name: "Bird Dog", equipment: "body weight", category: "waist", primary: ["lower back"], secondary: ["glutes", "abdominals", "shoulders"],
    instructions: [
      "Start on your hands and knees with your hands under your shoulders and your knees under your hips.",
      "Extend one arm forward and the opposite leg back until both are in line with your torso, keeping your hips level.",
      "Hold briefly, return, then switch sides.",
    ],
  },
  {
    id: "Hollow_Body_Hold", name: "Hollow Body Hold", equipment: "body weight", category: "waist", primary: ["abdominals"], secondary: ["quadriceps"],
    instructions: [
      "Lie on your back with your arms extended overhead and your legs straight.",
      "Press your lower back into the floor, then lift your shoulders and legs a few inches off the ground.",
      "Hold the position for the target time, keeping your ribs down.",
    ],
  },
  {
    id: "Cable_Woodchop", name: "Cable Woodchop", equipment: "cable", category: "waist", primary: ["abdominals"], secondary: ["obliques", "shoulders"],
    instructions: [
      "Set a cable at a high pulley and stand side-on to the stack, gripping the handle with both hands.",
      "Pull the handle diagonally down and across your body, rotating your torso and pivoting your back foot.",
      "Return slowly under control, finish your reps, then switch sides.",
    ],
  },
  {
    id: "Cable_Pallof_Press", name: "Cable Pallof Press", equipment: "cable", category: "waist", primary: ["abdominals"], secondary: ["obliques", "shoulders"],
    instructions: [
      "Set a cable at chest height and stand side-on to the stack, holding the handle against your chest with both hands.",
      "Brace your core and press the handle straight out in front of you, resisting the pull to rotate.",
      "Hold for a moment, bring it back to your chest, finish your reps, then switch sides.",
    ],
  },
  {
    id: "Rowing_Machine", name: "Rowing Machine", equipment: "leverage machine", category: "cardio", primary: [], secondary: ["lats", "quadriceps", "hamstrings", "glutes"],
    instructions: [
      "Sit on the rower with your feet strapped in and your hands on the handle, arms straight.",
      "Push with your legs first, then lean back slightly and pull the handle to your lower ribs.",
      "Extend your arms, then bring your torso forward and bend your knees to return to the start.",
    ],
  },
  {
    id: "Treadmill_Run", name: "Treadmill Run", equipment: "leverage machine", category: "cardio", primary: [], secondary: ["quadriceps", "hamstrings", "glutes", "calves"],
    instructions: [
      "Start the treadmill at a walking pace and step onto the belt.",
      "Build up to a comfortable running speed, landing softly under your hips with a relaxed upper body.",
      "Run for the target time or distance, then slow to a walk to cool down.",
    ],
  },
  {
    id: "Stationary_Bike", name: "Stationary Bike", equipment: "leverage machine", category: "cardio", primary: [], secondary: ["quadriceps", "hamstrings", "glutes", "calves"],
    instructions: [
      "Adjust the seat so your knee is slightly bent at the bottom of the pedal stroke.",
      "Pedal at a steady cadence with a relaxed upper body, adding resistance as needed.",
      "Ride for the target time, then ease the resistance down to cool off.",
    ],
  },
];

const entry = (o) => ({
  id: o.id, name: o.name, force: null, level: null, mechanic: null, equipment: o.equipment,
  primaryMuscles: o.primary, secondaryMuscles: o.secondary, instructions: o.instructions, category: o.category, images: o.images ?? [],
});

let added = 0;
for (const o of FROM_UPSTREAM) {
  if (byId.has(o.id)) {
    byId.get(o.id).name = o.name;
    continue;
  }
  const u = upstream.get(o.id);
  if (!u) throw new Error(`upstream has no ${o.id}`);
  data.push(entry({ ...o, category: o.category ?? u.body_part, instructions: u.instruction_steps?.en ?? [u.instructions?.en].filter(Boolean), images: [u.gif_url] }));
  added++;
}
for (const o of HAND) {
  if (byId.has(o.id)) continue;
  data.push(entry(o));
  added++;
}

writeFileSync(file, JSON.stringify(data));
console.log(`${renamed.size} explicit renames, ${added} added, ${data.length} exercises`);
