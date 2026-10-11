// Original body-map artwork: a stylized, simplified figure, one path per muscle region from the dataset vocabulary.
// Coordinates are in a 200 x 380 box, centered on x = 100. `side` paths are drawn for the left and mirrored for the right.

export type Region = { muscle: string; d: string; mirror: boolean };

export const VIEWBOX = "0 0 200 380";

const ARM_UPPER = "M47 104 C42 116 42 130 46 142 L58 142 C62 130 62 116 60 104 C56 106 50 106 47 104 Z";
const ARM_LOWER = "M44 146 C40 164 40 184 43 206 L55 208 C59 188 60 166 58 146 Z";
const DELT = "M70 68 C58 66 48 74 47 88 C46 98 52 104 60 100 C66 96 72 86 72 76 Z";

export const FRONT: Region[] = [
  { muscle: "neck", d: "M91 46 L109 46 L111 60 L89 60 Z", mirror: false },
  { muscle: "traps", d: "M89 58 L70 66 L80 74 L92 64 Z", mirror: true },
  { muscle: "shoulders", d: DELT, mirror: true },
  { muscle: "chest", d: "M97 68 C88 66 78 70 73 80 C72 92 78 106 97 108 Z", mirror: true },
  { muscle: "abdominals", d: "M85 112 C90 110 110 110 115 112 L114 168 C108 176 92 176 86 168 Z", mirror: false },
  { muscle: "biceps", d: ARM_UPPER, mirror: true },
  { muscle: "forearms", d: ARM_LOWER, mirror: true },
  { muscle: "abductors", d: "M64 170 L74 172 L74 198 L64 194 Z", mirror: true },
  { muscle: "quadriceps", d: "M78 178 L90 182 L90 276 L78 278 C72 248 72 210 78 178 Z", mirror: true },
  { muscle: "adductors", d: "M92 186 L99 190 L99 250 L94 268 L92 268 Z", mirror: true },
  { muscle: "calves", d: "M78 286 C74 312 76 342 82 368 L95 368 C98 342 98 312 94 286 Z", mirror: true },
];

export const BACK: Region[] = [
  { muscle: "neck", d: "M91 46 L109 46 L111 60 L89 60 Z", mirror: false },
  { muscle: "traps", d: "M100 56 C112 60 126 66 134 74 L100 112 L66 74 C74 66 88 60 100 56 Z", mirror: false },
  { muscle: "shoulders", d: DELT, mirror: true },
  { muscle: "lats", d: "M70 88 C66 108 74 134 94 152 L96 116 Z", mirror: true },
  { muscle: "middle back", d: "M86 100 L114 100 L114 138 L86 138 Z", mirror: false },
  { muscle: "lower back", d: "M86 140 L114 140 L113 168 L87 168 Z", mirror: false },
  { muscle: "triceps", d: ARM_UPPER, mirror: true },
  { muscle: "forearms", d: ARM_LOWER, mirror: true },
  { muscle: "abductors", d: "M64 172 L72 172 L72 200 L62 194 Z", mirror: true },
  { muscle: "glutes", d: "M72 172 C68 192 80 208 98 204 L98 172 Z", mirror: true },
  { muscle: "hamstrings", d: "M76 208 C70 236 72 260 78 280 L97 280 C99 258 99 232 98 208 Z", mirror: true },
  { muscle: "calves", d: "M77 286 C70 310 76 342 83 368 L95 368 C99 342 99 312 95 286 Z", mirror: true },
];

/** Unranked body parts, drawn quiet so the muscles read as the figure. */
export const DECOR: { d: string; mirror: boolean }[] = [
  { d: "M100 10 a16 18 0 1 0 0.01 0 Z", mirror: false },
  { d: "M44 210 C40 220 44 232 52 232 C58 230 58 218 56 210 Z", mirror: true },
  { d: "M78 372 C76 378 80 380 96 380 L96 372 Z", mirror: true },
];

/** Tiers in material order; ids match standards.TIERS lower-cased. */
export const MATERIAL_IDS = ["wood", "bronze", "silver", "gold", "platinum", "diamond", "master", "olympian"] as const;

// Quiet silhouette behind the regions so they read as one body, not floating parts. Left half, top to crotch; the right
// half is its mirror image.
const HALF: [number, number][] = [
  [91, 44], [91, 58], [70, 64], [50, 72], [42, 90], [38, 130], [36, 170], [37, 214], [58, 216], [60, 180], [62, 140],
  [66, 108], [72, 120], [78, 168], [66, 176], [68, 230], [72, 290], [77, 372], [97, 380], [100, 372], [100, 290], [100, 196],
];

export const SILHOUETTE =
  "M" +
  [...HALF, ...[...HALF].reverse().map(([x, y]) => [200 - x, y] as [number, number])].map(([x, y]) => `${x} ${y}`).join(" L") +
  " Z";
