import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "correct-horse-battery";

// A fresh account per test keeps profile state isolated; the local stack has email confirmation off.
async function newUser(): Promise<string> {
  const email = `e2e-${crypto.randomUUID()}@test.local`;
  const res = await fetch(`${process.env.E2E_SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: process.env.E2E_SUPABASE_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(res.ok).toBe(true);
  return email;
}

// Profile edits save in the background. Reloading before the PATCH lands would (correctly) show the old value.
async function profileSaved(page: Page, action: () => Promise<unknown>) {
  const saved = page.waitForResponse((r) => r.url().includes("/rest/v1/profiles") && r.request().method() === "PATCH");
  await action();
  await saved;
}

async function signIn(page: Page, hash = "dashboard") {
  const email = await newUser();
  await page.goto(`#/${hash}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function signInAndSkipSetup(page: Page, hash = "dashboard") {
  await signIn(page, hash);
  await page.getByRole("button", { name: "Skip for now" }).click();
}

const tabs = [
  ["dashboard", "Dashboard"],
  ["log", "Session"],
  ["routines", "Routines"],
  ["library", "Exercises"],
  ["weight", "Weight"],
  ["steps", "Steps"],
];

for (const [id, label] of tabs) {
  test(`${label} tab shows only its own content`, async ({ page }) => {
    await signInAndSkipSetup(page, id);
    await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("production build ships a CSP meta tag", async ({ page }) => {
  await page.goto("#/dashboard");
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("script-src 'self'");
});

test("sign-in rejects a wrong password with a readable message", async ({ page }) => {
  await page.goto("#/dashboard");
  await page.getByLabel("Email").fill("nobody@test.local");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/invalid/i);
});

test("theme choice is saved to the profile and survives a fresh browser", async ({ page, browser }) => {
  await signInAndSkipSetup(page);
  await page.goto("#/settings");
  await profileSaved(page, () => page.getByLabel("Theme").selectOption("dark"));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // Same account, empty localStorage: the profile has to supply the theme.
  const state = await page.context().storageState();
  state.origins = state.origins.map((o) => ({ ...o, localStorage: o.localStorage.filter((i) => i.name.startsWith("sb-")) }));
  const ctx = await browser.newContext({ storageState: state, baseURL: "http://localhost:4173/GymTrackerApp/" });
  const other = await ctx.newPage();
  await other.goto("#/dashboard");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 20_000 });
  await ctx.close();
});

test("ranking setup saves unit and standards, then stops asking", async ({ page }) => {
  await signIn(page);
  await page.getByLabel("Weight unit").selectOption("lb");
  await page.getByLabel(/Current bodyweight/).fill("185.5");
  await page.getByLabel("Strength standards table").selectOption("female");
  await page.getByRole("button", { name: "Save ranking setup" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await page.goto("#/settings");
  await expect(page.getByLabel("Weight unit")).toHaveValue("lb");
  await expect(page.getByLabel("Strength standards")).toHaveValue("female");
});

test("settings changes persist after reload", async ({ page }) => {
  await signInAndSkipSetup(page, "settings");
  await profileSaved(page, () => page.getByLabel("Week starts on").selectOption("0"));
  await profileSaved(page, () => page.getByLabel("Start rest after each set").check());
  await expect(page.getByLabel("Start rest after each set")).toBeChecked();
  await page.reload();
  await expect(page.getByLabel("Week starts on")).toHaveValue("0");
  await expect(page.getByLabel("Start rest after each set")).toBeChecked();
});

test.describe("exercise library", () => {
  test("search narrows a virtualized list and opens a detail sheet", async ({ page }) => {
    await signInAndSkipSetup(page, "library");
    await expect(page.getByText(/^\d+ exercises$/)).toBeVisible();
    // 876 exercises must not all be in the DOM.
    expect(await page.locator("a[href*='library/']").count()).toBeLessThan(60);

    await page.getByRole("searchbox", { name: "Search exercises" }).fill("palms-down wrist curl");
    await page.getByRole("link", { name: /Seated Dumbbell Palms-Down Wrist Curl/ }).first().click();
    const sheet = page.getByRole("dialog", { name: /Palms-Down Wrist Curl/ });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "How to perform" })).toBeVisible();
    await expect(sheet.locator("ol li").first()).toBeVisible();
    await expect(sheet.getByText("Forearms").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/#\/library$/);
  });

  test("a detail link opens directly, and filters narrow the list", async ({ page }) => {
    await signInAndSkipSetup(page, "library/ds%3ABarbell_Curl");
    await expect(page.getByRole("dialog", { name: "Barbell Curl" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Filters" }).click();
    await page.getByLabel("Muscle").selectOption("neck");
    await expect(page.getByText("8 exercises")).toBeVisible();
  });

  test("a custom exercise can be created, shown, edited and deleted", async ({ page }) => {
    await signInAndSkipSetup(page, "library");
    await page.getByRole("button", { name: "New exercise" }).click();
    await page.getByLabel("Name").fill("Neck harness curl");
    await page.getByRole("group", { name: "Primary muscles" }).getByText("Neck", { exact: true }).click();
    await page.getByLabel("Steps (one per line)").fill("Attach the harness\nCurl your chin down");
    await page.getByRole("button", { name: "Create exercise" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("searchbox", { name: "Search exercises" }).fill("harness curl");
    await page.getByRole("link", { name: /Neck harness curl/ }).click();
    const sheet = page.getByRole("dialog", { name: "Neck harness curl" });
    await expect(sheet.locator("ol li")).toHaveCount(2);

    await sheet.getByRole("button", { name: "Edit exercise" }).click();
    await page.getByRole("button", { name: "Delete exercise" }).click();
    await page.getByRole("dialog", { name: "Delete Neck harness curl?" }).getByRole("button", { name: "Delete exercise" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: /Neck harness curl/ })).toHaveCount(0);
  });
});

test.describe("routine builder", () => {

  async function openBuilder(page: Page) {
    await signInAndSkipSetup(page, "routines");
    await newRoutine(page);
  }

  async function newRoutine(page: Page) {
    await page.getByRole("button", { name: "New routine" }).click();
    await page.getByLabel("Routine name").fill("New routine");
    await page.getByRole("button", { name: "Save routine" }).click();
    await expect(page.getByRole("region", { name: "Routine overview" }).getByRole("heading", { name: "New routine" })).toBeVisible();
  }

  const showDay = async (page: Page, day: string) => {
    await page.getByRole("tab", { name: day.slice(0, 3) === "Ban" ? "Bank" : day.slice(0, 3) }).click();
  };

  // "Add exercise" opens the picker as a popup. Add puts the exercise on the day being viewed.
  async function addExercise(page: Page, name: string, to: string) {
    await showDay(page, to === "Accessory bank" ? "Bank" : to);
    await page.getByRole("button", { name: "Add exercise" }).click();
    await page.getByLabel("Search the picker").fill(name);
    await page.getByRole("button", { name: `Add ${name} to ${to}`, exact: true }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
  }

  test("adds an exercise, edits sets, and keeps it after reload", async ({ page }) => {
    await openBuilder(page);
    await addExercise(page, "Barbell Curl", "Monday");
    await showDay(page, "Monday");
    const card = page.getByRole("article", { name: "Barbell Curl" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: /^Edit / }).click();
    await card.getByRole("button", { name: "Increase Sets" }).click();
    await expect(card.getByRole("group", { name: "Sets" }).getByRole("status")).toHaveText("4");
    await card.getByRole("button", { name: "Increase Rest" }).click();
    await expect(card.getByRole("group", { name: "Rest" }).getByRole("status")).toHaveText("1:45");

    await expect(page.getByText("All changes saved")).toBeVisible();
    await page.reload();
    await showDay(page, "Monday");
    const again = page.getByRole("article", { name: "Barbell Curl" });
    await again.getByRole("button", { name: /^Edit / }).click();
    await expect(again.getByRole("group", { name: "Sets" }).getByRole("status")).toHaveText("4");
    await expect(page.getByRole("region", { name: "Weekly sets per muscle" })).toContainText("Biceps");
  });

  test("unlinks a superset into separate cards", async ({ page }) => {
    await signInAndSkipSetup(page, "routines");
    const routine = {
      format: "tempered-routine", version: 1, name: "Superset",
      days: [{ weekday: 1, label: "", blocks: [{ sets: 3, restS: 60, transitionRestS: 0, items: [
        { ref: "ds:Barbell_Curl", repMin: 8, repMax: 12 }, { ref: "ds:Barbell_Bench_Press_-_Medium_Grip", repMin: 8, repMax: 12 },
      ] }] }],
      bank: [],
    };
    await page.locator('input[type="file"]').setInputFiles({ name: "s.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(routine)) });
    await showDay(page, "Monday");
    await expect(page.getByRole("article")).toHaveCount(1);
    await page.getByRole("button", { name: /^Edit / }).click();
    await page.getByRole("button", { name: "Unlink" }).click();
    await expect(page.getByRole("article")).toHaveCount(2);
  });

  test("bank blocks count seven days of volume and a schedule change updates it", async ({ page }) => {
    await openBuilder(page);
    await addExercise(page, "Standing Calf Raises", "Accessory bank");
    await showDay(page, "Bank");
    await expect(page.getByRole("region", { name: "Weekly sets per muscle" })).toContainText(/Calves\s*21/);
    const card = page.getByRole("article", { name: "Standing Calf Raises" });
    await card.getByRole("button", { name: /^Edit / }).click();
    await card.getByLabel("Schedule").selectOption("week");
    await expect(page.getByRole("region", { name: "Weekly sets per muscle" })).toContainText(/Calves\s*6/);
  });

  test("exports a routine and imports it back, and rejects a bad file with reasons", async ({ page }) => {
    await openBuilder(page);
    await addExercise(page, "Barbell Curl", "Monday");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Export JSON" }).click();
    const file = await download;
    const path = await file.path();
    const fs = await import("node:fs/promises");
    const text = await fs.readFile(path!, "utf8");
    expect(JSON.parse(text)).toMatchObject({ format: "tempered-routine", version: 1 });

    await page.locator('input[type="file"]').setInputFiles({ name: "routine.json", mimeType: "application/json", buffer: Buffer.from(text) });
    await expect(page.getByLabel("Routine", { exact: true }).locator("option")).toHaveCount(2);

    const bad = JSON.stringify({ format: "tempered-routine", version: 1, name: "Bad", days: [{ weekday: 1, label: "", blocks: [{ sets: 0, restS: 60, items: [{ ref: "ds:Nope", repMin: 10, repMax: 8 }] }] }], bank: [] });
    await page.locator('input[type="file"]').setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from(bad) });
    await expect(page.getByRole("alert")).toContainText("unknown exercise ds:Nope");
  });

  test("only one routine is active", async ({ page }) => {
    await openBuilder(page);
    await expect(page.getByLabel("Routine", { exact: true })).toContainText("(active)");
    await newRoutine(page);
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Make active" }).click();
    await expect(page.getByText("All changes saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Routine", { exact: true }).locator("option", { hasText: "(active)" })).toHaveCount(1);
  });

  test("reorders cards with the keyboard", async ({ page }) => {
    await openBuilder(page);
    await addExercise(page, "Barbell Curl", "Monday");
    await addExercise(page, "Barbell Bench Press - Medium Grip", "Monday");
    await showDay(page, "Monday");
    const names = () => page.getByRole("region", { name: "Monday" }).getByRole("article").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(await names()).toEqual(["Barbell Curl", "Barbell Bench Press - Medium Grip"]);
    await page.getByRole("button", { name: "Reorder Barbell Curl" }).focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[aria-live]")).toContainText("Draggable item");
    await page.waitForTimeout(400); // dnd-kit measures drop targets just after pick-up; Arrow before that is ignored
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
    await page.keyboard.press("Space");
    await expect.poll(names).toEqual(["Barbell Bench Press - Medium Grip", "Barbell Curl"]);
  });

  async function importMonday(page: Page, blocks: string[][]) {
    await signInAndSkipSetup(page, "routines");
    const routine = {
      format: "tempered-routine", version: 1, name: "Select",
      days: [{ weekday: 1, label: "", blocks: blocks.map((refs) => ({ sets: 3, restS: 60, transitionRestS: 0, items: refs.map((ref) => ({ ref, repMin: 8, repMax: 12 })) })) }],
      bank: [],
    };
    await page.locator('input[type="file"]').setInputFiles({ name: "s.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(routine)) });
    await showDay(page, "Monday");
  }
  const MON = ["ds:Barbell_Curl", "ds:Barbell_Bench_Press_-_Medium_Grip", "ds:Bent_Over_Barbell_Row"];

  test("exercises inside a superset have no drag handle", async ({ page }) => {
    await importMonday(page, [[MON[0], MON[1]]]);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /out of the superset/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(1);
  });

  test("Select links two cards as a superset and three as a circuit", async ({ page }) => {
    await importMonday(page, MON.map((r) => [r]));
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(0); // grips give way to checkboxes
    await expect(page.getByRole("button", { name: "Link as superset" })).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Select Barbell Curl" }).check();
    await page.getByRole("checkbox", { name: "Select Barbell Bench Press" }).check();
    await page.getByRole("button", { name: "Link as superset" }).click();
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByRole("button", { name: /^Reorder / })).toHaveCount(2); // back to normal

    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByRole("checkbox", { name: /^Select Barbell Curl and/ }).check();
    await page.getByRole("checkbox", { name: /^Select Barbell Bent Over Row/ }).check();
    await page.getByRole("button", { name: "Link as superset" }).click();
    await expect(page.getByRole("article")).toHaveCount(1);

    await page.getByRole("button", { name: /^Edit Barbell Curl/ }).click();
    await page.getByRole("button", { name: "Unlink" }).click();
    await expect(page.getByRole("article")).toHaveCount(3);
  });

  test("Select can be cancelled", async ({ page }) => {
    await importMonday(page, MON.slice(0, 2).map((r) => [r]));
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByRole("checkbox", { name: "Select Barbell Curl" }).check();
    await expect(page.getByText("1 selected")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(2);
  });
});

test.describe("session log", () => {
  const routineJson = JSON.stringify({
    format: "tempered-routine", version: 1, name: "Push pull",
    days: [{ weekday: 1, label: "Upper 1", blocks: [
      { sets: 3, restS: 90, transitionRestS: 0, items: [{ ref: "ds:Barbell_Curl", repMin: 8, repMax: 10 }] },
      { sets: 2, restS: 60, transitionRestS: 0, items: [{ ref: "ds:Barbell_Bench_Press_-_Medium_Grip", repMin: 8, repMax: 12 }, { ref: "ds:Bent_Over_Barbell_Row", repMin: 8, repMax: 12 }] },
    ] }],
    bank: [{ sets: 2, restS: 45, transitionRestS: 0, weekdays: [0, 1, 2, 3, 4, 5, 6], weeklyTarget: null, items: [{ ref: "ds:Standing_Calf_Raises", repMin: 10, repMax: 15 }] }],
  });

  async function withRoutine(page: Page) {
    await signInAndSkipSetup(page, "routines");
    await page.locator('input[type="file"]').setInputFiles({ name: "r.json", mimeType: "application/json", buffer: Buffer.from(routineJson) });
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("menuitem", { name: "Make active" }).click();
    await expect(page.getByText("All changes saved")).toBeVisible();
    await page.goto("#/log");
    await page.getByLabel("Day").selectOption("1");
    await page.getByRole("button", { name: "Start session" }).click();
  }

  const curl = (page: Page) => page.getByRole("article", { name: "Barbell Curl" });
  const fill = async (page: Page, set: number, weight: string, reps: string) => {
    await curl(page).getByLabel(`Set ${set} weight (kg)`).fill(weight);
    await curl(page).getByLabel(`Set ${set} reps`).fill(reps);
    await curl(page).getByRole("button", { name: `Mark Set ${set} done` }).click();
  };

  test("logs a quick session, shows the summary, and lists it in past sessions", async ({ page }) => {
    await signInAndSkipSetup(page, "log");
    await page.getByRole("button", { name: "Start quick session" }).click();
    await page.getByRole("button", { name: "Add exercise" }).click();
    await page.getByLabel("Search exercises to add").fill("Barbell Curl");
    await page.getByRole("button", { name: /^Barbell Curl/ }).first().click();
    await expect(curl(page)).toBeVisible();
    await fill(page, 1, "40", "10");
    await fill(page, 2, "40", "8");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.getByRole("button", { name: "Finish session" }).click();
    await expect(page.getByRole("heading", { name: "Session saved" })).toBeVisible();
    await expect(page.getByText("720 kg")).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByRole("region", { name: "Past sessions" }).locator("summary")).toContainText("2 sets");
  });

  test("shows ghost values and a recommendation from the last session", async ({ page }) => {
    await withRoutine(page);
    for (const n of [1, 2, 3]) await fill(page, n, "40", "10");
    await page.getByRole("button", { name: "Finish session" }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();

    await page.getByLabel("Day").selectOption("1");
    await page.getByRole("button", { name: "Start session" }).click();
    await expect(curl(page).getByLabel("Set 1 weight (kg)")).toHaveAttribute("placeholder", "40");
    await expect(curl(page).getByLabel("Set 1 reps")).toHaveAttribute("placeholder", "10");
    await curl(page).getByRole("button", { name: "Try 42.5 x 8" }).click();
    await expect(curl(page).getByLabel("Set 2 weight (kg)")).toHaveValue("42.5");
    await expect(curl(page).getByLabel("Set 3 reps")).toHaveValue("8");
    await expect(curl(page).getByText("Hit 10, 10, 10 at 40 kg last time")).toBeVisible();
  });

  test("keeps logged sets and typed values across a reload", async ({ page }) => {
    await withRoutine(page);
    await fill(page, 1, "50", "9");
    await curl(page).getByLabel("Set 2 weight (kg)").fill("52.5");
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(curl(page).getByLabel("Set 1 weight (kg)")).toHaveValue("50");
    await expect(curl(page).getByRole("button", { name: "Undo Set 1" })).toBeVisible();
    await expect(curl(page).getByLabel("Set 2 weight (kg)")).toHaveValue("52.5");
  });

  test("queues a set while offline and syncs when the connection returns", async ({ page, context }) => {
    await withRoutine(page);
    // The exercise list loads lazily; names must be in before the connection drops.
    await expect(curl(page)).toBeVisible();
    await context.setOffline(true);
    await fill(page, 1, "45", "8");
    await expect(curl(page).getByRole("button", { name: "Undo Set 1" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Will retry" })).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(curl(page).getByLabel("Set 1 weight (kg)")).toHaveValue("45");
  });

  test("moves focus through a superset and labels the rest button with the block's rest", async ({ page }) => {
    await withRoutine(page);
    const ss = page.getByRole("article", { name: /Barbell Bench Press - Medium Grip and Bent Over Barbell Row/ });
    await ss.getByLabel("Barbell Bench Press - Medium Grip round 1 weight (kg)").fill("60");
    await ss.getByLabel("Barbell Bench Press - Medium Grip round 1 reps").fill("8");
    await ss.getByRole("button", { name: "Mark Barbell Bench Press - Medium Grip round 1 done" }).click();
    await expect(ss.getByLabel("Bent Over Barbell Row round 1 weight (kg)")).toBeFocused();
    // The last logged item sits mid-round with no transition rest, so the block's rest applies.
    await expect(page.getByRole("button", { name: "Rest 1:00" })).toBeVisible();
  });

  test("rest timer counts down, adjusts, and can be skipped", async ({ page }) => {
    await withRoutine(page);
    await page.getByRole("button", { name: "Rest 1:30" }).click();
    const timer = page.getByRole("timer");
    await expect(timer).toContainText(/1:(29|30)/);
    await page.getByRole("button", { name: "Add 15 seconds" }).click();
    await expect(timer).toContainText(/1:(4\d)/);
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("button", { name: /^Rest \d/ })).toBeVisible();
  });

  test("warm-ups are excluded from volume, and a past session can be corrected", async ({ page }) => {
    await withRoutine(page);
    await curl(page).getByText("More").click();
    await curl(page).getByRole("button", { name: "Add warm-up" }).click();
    await curl(page).getByLabel("Warm-up 1 weight (kg)").fill("20");
    await curl(page).getByLabel("Warm-up 1 reps").fill("12");
    await curl(page).getByRole("button", { name: "Mark Warm-up 1 done" }).click();
    await fill(page, 1, "40", "10");
    await page.getByRole("button", { name: "Finish session" }).click();
    await expect(page.getByText("400 kg")).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();

    const past = page.getByRole("region", { name: "Past sessions" });
    await past.locator("summary").click();
    await past.getByLabel("Reps").nth(1).fill("12");
    await past.getByLabel("Reps").nth(1).blur();
    await expect(past.locator("summary")).toContainText("480 kg");
  });

  test("skipping an exercise and adding a set work", async ({ page }) => {
    await withRoutine(page);
    await curl(page).getByText("More").click();
    await curl(page).getByRole("button", { name: "Add set" }).click();
    await expect(curl(page).getByLabel("Set 4 weight (kg)")).toBeVisible();
    await curl(page).getByRole("button", { name: "Skip exercise" }).click();
    await expect(curl(page).getByText("Skipped")).toBeVisible();
    await expect(curl(page).getByLabel("Set 1 weight (kg)")).toHaveCount(0);
  });

  test("accessory bank blocks scheduled today sit in a collapsible group", async ({ page }) => {
    await withRoutine(page);
    const group = page.getByText("Accessories (1)");
    await expect(group).toBeVisible();
    await expect(page.getByRole("article", { name: "Standing Calf Raises" })).toBeVisible();
    await group.click();
    await expect(page.getByRole("article", { name: "Standing Calf Raises" })).toBeHidden();
  });
});

test.describe("dashboard and ranks", () => {
  type Seed = { email: string; token: string; userId: string };

  const headers = (token: string) => ({ apikey: process.env.E2E_SUPABASE_KEY!, Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
  const rest = async (seed: Seed, path: string, method: string, body?: unknown) => {
    const r = await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/${path}`, { method, headers: headers(seed.token), body: body ? JSON.stringify(body) : undefined });
    expect(r.ok, `${method} ${path}`).toBe(true);
  };

  async function seededUser(opts: { standards?: boolean } = { standards: true }): Promise<Seed> {
    const email = `e2e-${crypto.randomUUID()}@test.local`;
    const r = await fetch(`${process.env.E2E_SUPABASE_URL}/auth/v1/signup`, {
      method: "POST", headers: headers(process.env.E2E_SUPABASE_KEY!), body: JSON.stringify({ email, password: PASSWORD }),
    });
    const j = await r.json();
    const seed = { email, token: j.access_token as string, userId: j.user.id as string };
    if (opts.standards !== false) {
      await rest(seed, `profiles?id=eq.${seed.userId}`, "PATCH", { standards_table: "male" });
      await rest(seed, "bodyweight_entries", "POST", { measured_on: "2026-01-01", weight_kg: 80 });
    }
    return seed;
  }

  async function addSession(seed: Seed, sets: { ref: string; w: number; reps: number }[], daysAgo = 2) {
    const id = crypto.randomUUID();
    const start = new Date(Date.now() - daysAgo * 86_400_000);
    await rest(seed, "sessions", "POST", { id, started_at: start.toISOString(), ended_at: new Date(start.getTime() + 3_600_000).toISOString() });
    await rest(seed, "session_sets", "POST", sets.map((s, i) => ({
      id: crypto.randomUUID(), session_id: id, exercise_ref: `ds:${s.ref}`, round_index: i, set_number: i + 1, weight_kg: s.w, reps: s.reps,
      is_warmup: false, completed_at: new Date(start.getTime() + i * 60_000).toISOString(),
    })));
  }

  async function open(page: Page, seed: Seed, hash = "dashboard") {
    await page.goto(`#/${hash}`);
    await page.getByLabel("Email").fill(seed.email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }

  const BENCH = "Barbell_Bench_Press_-_Medium_Grip";

  test("asks for setup before showing ranks", async ({ page }) => {
    const seed = await seededUser({ standards: false });
    await open(page, seed);
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByText("Add your bodyweight to see ranks")).toBeVisible();
    await expect(page.getByRole("link", { name: "Set up ranks" })).toBeVisible();
  });

  test("colors a muscle by tier and explains it in a detail sheet", async ({ page }) => {
    const seed = await seededUser();
    await addSession(seed, [{ ref: BENCH, w: 100, reps: 5 }]);
    await open(page, seed);
    await page.getByRole("button", { name: "Chest, Platinum. Show details" }).click();
    const sheet = page.getByRole("dialog", { name: "Chest" });
    await expect(sheet.getByText("Platinum", { exact: true }).first()).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Barbell Bench Press - Medium Grip" }).first()).toBeVisible();
    await expect(sheet).toContainText("1.5× bodyweight");
    await page.keyboard.press("Escape");
    // Unranked muscles are neutral, not Wood.
    await expect(page.getByRole("button", { name: "Calves, no data. Show details" }).first()).toBeVisible();
    await expect(page.getByText(/^Platinum$/).first()).toBeVisible(); // overall
  });

  test("shows the front and back maps together", async ({ page }) => {
    const seed = await seededUser();
    await addSession(seed, [{ ref: BENCH, w: 100, reps: 5 }]);
    await open(page, seed);
    await expect(page.getByRole("group", { name: "Body map, front" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Body map, back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show as list" })).toHaveCount(0);
  });

  test("holds back an implausible entry until it is confirmed", async ({ page }) => {
    const seed = await seededUser();
    await addSession(seed, [{ ref: BENCH, w: 450, reps: 3 }]);
    await open(page, seed);
    await expect(page.getByRole("heading", { name: "Check these entries" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Chest, no data. Show details" })).toBeVisible();
    await page.getByRole("button", { name: "Yes, it's right" }).click();
    await expect(page.getByRole("heading", { name: "Check these entries" })).toBeHidden();
    await expect(page.getByRole("button", { name: /^Chest, (?!no data)/ })).toBeVisible();
  });

  test("plays the rank-up once, then not again", async ({ page }) => {
    const seed = await seededUser();
    await addSession(seed, [{ ref: BENCH, w: 100, reps: 5 }], 5);
    await open(page, seed);
    await expect(page.getByRole("button", { name: "Chest, Platinum. Show details" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "reached" })).toHaveCount(0); // first visit only records tiers

    await addSession(seed, [{ ref: BENCH, w: 110, reps: 5 }], 1); // 128 / 80 = 1.6x: Diamond
    await page.reload();
    const banner = page.getByRole("status").filter({ hasText: "Chest reached Diamond" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Skip" }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("button", { name: "Chest, Diamond. Show details" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "reached" })).toHaveCount(0);
  });

  test("charts the estimated 1RM, weekly sets, bodyweight and recent bests", async ({ page }) => {
    const seed = await seededUser();
    await addSession(seed, [{ ref: BENCH, w: 100, reps: 5 }], 9);
    await addSession(seed, [{ ref: BENCH, w: 105, reps: 5 }], 2);
    await open(page, seed);
    await expect(page.getByRole("img", { name: /Barbell Bench Press - Medium Grip estimated 1RM: 2 points/ })).toBeVisible();
    await page.getByRole("radio", { name: "4 weeks" }).click();
    await expect(page.getByRole("img", { name: /estimated 1RM: 2 points/ })).toBeVisible();
    await expect(page.getByRole("img", { name: "2 sessions in the last 12 weeks" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent personal bests" })).toContainText("Barbell Bench Press - Medium Grip");
  });

  test("adds and deletes bodyweight on the weight tab", async ({ page }) => {
    const seed = await seededUser();
    await open(page, seed, "weight");
    await expect(page.getByRole("img", { name: /Bodyweight: 1 points/ })).toBeVisible();
    await page.getByLabel("Add bodyweight (kg)").fill("81.5");
    await page.getByRole("button", { name: "Add weight" }).click();
    await expect(page.getByRole("img", { name: /Bodyweight: 2 points, latest 81.5 kg/ })).toBeVisible();
    await page.getByRole("button", { name: /^Delete weight from/ }).first().click();
    await page.getByRole("dialog", { name: "Delete this weight?" }).getByRole("button", { name: "Delete weight" }).click();
    await expect(page.getByRole("img", { name: /Bodyweight: 1 points/ })).toBeVisible();
  });

  test("logs steps, replaces a day's total and deletes it on the steps tab", async ({ page }) => {
    const seed = await seededUser();
    await open(page, seed, "steps");
    await expect(page.getByText("No steps yet")).toBeVisible();
    await expect(page.getByLabel("Averages")).toContainText("–");
    await page.getByLabel("Add steps for today").fill("8000");
    await page.getByRole("button", { name: "Add steps" }).click();
    await expect(page.getByRole("img", { name: /Steps: 1 points, latest 8000 steps/ })).toBeVisible();
    await expect(page.getByLabel("Averages")).toContainText("8,000 steps");
    await page.getByLabel("Add steps for today").fill("9000");
    await page.getByRole("button", { name: "Add steps" }).click();
    await expect(page.getByRole("img", { name: /Steps: 1 points, latest 9000 steps/ })).toBeVisible();
    await page.getByRole("button", { name: /^Delete steps from/ }).click();
    await page.getByRole("dialog", { name: "Delete these steps?" }).getByRole("button", { name: "Delete steps" }).click();
    await expect(page.getByText("No steps yet")).toBeVisible();
  });

  test("edited standards persist", async ({ page }) => {
    const seed = await seededUser();
    await addSession(seed, [{ ref: BENCH, w: 100, reps: 5 }]);
    await open(page, seed, "settings");
    await page.getByText("Edit strength standards").click();
    // Diamond for bench defaults to 1.5; making it 1.4 puts the 1.46x lift in Diamond.
    const diamond = page.getByLabel("Barbell Bench Press - Medium Grip Diamond multiple");
    await diamond.fill("1.4");
    await profileSaved(page, () => diamond.blur());
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.goto("#/dashboard");
    await expect(page.getByRole("button", { name: "Chest, Diamond. Show details" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Chest, Diamond. Show details" })).toBeVisible();
  });

  test("rejects a non-rising standards edit with a reason", async ({ page }) => {
    const seed = await seededUser();
    await open(page, seed, "settings");
    await page.getByText("Edit strength standards").click();
    const gold = page.getByLabel("Barbell Bench Press - Medium Grip Gold multiple");
    await gold.fill("0.4");
    await gold.blur();
    await expect(page.getByRole("alert")).toContainText("higher than the one before");
    await expect(gold).toHaveValue("1");
  });
});

test.describe("pwa and background alarm", () => {
  const stubPush = `
    (() => {
      const endpoint = "https://push-test.invalid/e2e-" + Math.random().toString(36).slice(2);
      const fake = { endpoint, toJSON: () => ({ endpoint, keys: { p256dh: "BAAA", auth: "AAAA" } }), unsubscribe: async () => { window.__pushSub = null; return true; } };
      PushManager.prototype.subscribe = async function () { window.__pushSub = fake; return fake; };
      PushManager.prototype.getSubscription = async function () { return window.__pushSub ?? null; };
      // Headless Chromium reports notifications as denied; model the permission prompt instead.
      let permission = "default";
      Object.defineProperty(Notification, "permission", { get: () => permission, configurable: true });
      Notification.requestPermission = async () => (permission = "granted");
    })();`;

  const hdr = (token: string) => ({ apikey: process.env.E2E_SUPABASE_KEY!, Authorization: `Bearer ${token}` });

  async function userWithToken() {
    const email = `e2e-${crypto.randomUUID()}@test.local`;
    const r = await fetch(`${process.env.E2E_SUPABASE_URL}/auth/v1/signup`, {
      method: "POST", headers: { apikey: process.env.E2E_SUPABASE_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }),
    });
    const j = await r.json();
    return { email, token: j.access_token as string };
  }

  async function login(page: Page, email: string, hash: string) {
    await page.goto(`#/${hash}`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("button", { name: "Skip for now" }).click();
  }

  test("serves a web app manifest with icons and registers a service worker", async ({ page }) => {
    await page.goto("");
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href;
      return (await fetch(href)).json();
    });
    expect(manifest).toMatchObject({ name: "Tempered", display: "standalone" });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain("512x512");
    expect(await page.evaluate(() => navigator.serviceWorker.ready.then((r) => Boolean(r.active)))).toBe(true);
  });

  test("loads the app shell with no connection", async ({ page, context }) => {
    await page.goto("");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tempered" })).toBeVisible();
  });

  test("turns notifications on, stores the subscription, and can turn them off", async ({ page }) => {
    await page.addInitScript(stubPush);
    const u = await userWithToken();
    await login(page, u.email, "settings");
    await page.getByRole("button", { name: "Turn on notifications" }).click();
    await expect(page.getByText("Notifications are on.")).toBeVisible();
    const rows = await (await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,deleted_at`, { headers: hdr(u.token) })).json();
    expect(rows).toHaveLength(1);
    expect(rows[0].endpoint).toContain("push-test.invalid");
    expect(rows[0].deleted_at).toBeNull();

    await page.getByRole("button", { name: "Turn off notifications" }).click();
    await expect(page.getByRole("button", { name: "Turn on notifications" })).toBeVisible();
    const after = await (await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/push_subscriptions?select=deleted_at`, { headers: hdr(u.token) })).json();
    expect(after[0].deleted_at).not.toBeNull();
  });

  test("arms a server alarm when rest starts and cancels it on skip", async ({ page }) => {
    await page.addInitScript(stubPush);
    const u = await userWithToken();
    await login(page, u.email, "settings");
    await page.getByRole("button", { name: "Turn on notifications" }).click();
    await expect(page.getByText("Notifications are on.")).toBeVisible();

    await page.goto("#/log");
    await page.getByRole("button", { name: "Start quick session" }).click();
    await page.getByRole("button", { name: "Rest 1:30" }).click();
    await expect(page.getByText("Background alarm on")).toBeVisible();

    const timers = async () =>
      (await (await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/rest_timers?select=fire_at,cancelled_at,sent_at&order=created_at`, { headers: hdr(u.token) })).json()) as { fire_at: string; cancelled_at: string | null }[];
    await expect.poll(async () => (await timers()).length).toBe(1);
    const [armed] = await timers();
    const ahead = (Date.parse(armed.fire_at) - Date.now()) / 1000;
    expect(ahead).toBeGreaterThan(70);
    expect(ahead).toBeLessThan(95);
    expect(armed.cancelled_at).toBeNull();

    await page.getByRole("button", { name: "Add 15 seconds" }).click();
    await expect.poll(async () => (await timers()).length).toBe(2); // the old row is cancelled, a new one armed
    expect((await timers())[0].cancelled_at).not.toBeNull();

    await page.getByRole("button", { name: "Skip" }).click();
    await expect.poll(async () => (await timers()).every((t) => t.cancelled_at !== null)).toBe(true);
  });

  test("times the server alarm by the server clock when the phone clock runs fast", async ({ page }) => {
    await page.addInitScript(stubPush);
    await page.addInitScript(() => {
      const real = Date.now;
      Date.now = () => real() + 60_000;
    });
    const u = await userWithToken();
    await login(page, u.email, "settings");
    await page.getByRole("button", { name: "Turn on notifications" }).click();
    await page.goto("#/log");
    await page.getByRole("button", { name: "Start quick session" }).click();
    await page.getByRole("button", { name: "Rest 1:30" }).click();
    await expect(page.getByText("Background alarm on")).toBeVisible();

    const [armed] = (await (await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/rest_timers?select=fire_at`, { headers: hdr(u.token) })).json()) as { fire_at: string }[];
    const ahead = (Date.parse(armed.fire_at) - Date.now()) / 1000;
    expect(ahead).toBeGreaterThan(80);
    expect(ahead).toBeLessThan(95);
  });

  test("keeps the server alarm when the rest ends while the page is hidden", async ({ page }) => {
    await page.addInitScript(stubPush);
    const u = await userWithToken();
    await login(page, u.email, "settings");
    await page.getByRole("button", { name: "Turn on notifications" }).click();
    await expect(page.getByText("Notifications are on.")).toBeVisible();

    await page.goto("#/log");
    await page.getByRole("button", { name: "Start quick session" }).click();
    await page.getByRole("button", { name: "Rest 1:30" }).click();
    await expect(page.getByText("Background alarm on")).toBeVisible();

    // The phone is locked or the user switched apps, but the page still ticks.
    await page.evaluate(() => Object.defineProperty(document, "visibilityState", { get: () => "hidden" }));
    for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Subtract 15 seconds" }).click();
    await expect(page.getByText("Rest done")).toBeVisible();

    const timers = async () =>
      (await (await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/rest_timers?select=cancelled_at&order=created_at`, { headers: hdr(u.token) })).json()) as { cancelled_at: string | null }[];
    await expect.poll(async () => (await timers()).length).toBe(7);
    await page.waitForTimeout(1500); // give a wrongful cancel time to land
    expect((await timers()).at(-1)!.cancelled_at).toBeNull();
  });

  test("says the background alarm is off when notifications are not enabled", async ({ page }) => {
    const u = await userWithToken();
    await login(page, u.email, "log");
    await page.getByRole("button", { name: "Start quick session" }).click();
    await page.getByRole("button", { name: "Rest 1:30" }).click();
    await expect(page.getByText("Background alarm off. Turn on notifications in Settings.")).toBeVisible();
  });
});

test.describe("iPhone in Safari", () => {
  test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });

  test("shows the Home Screen install guide instead of a permission button", async ({ page }) => {
    await signInAndSkipSetup(page, "settings");
    await expect(page.getByText("notifications only work once Tempered is on your Home Screen")).toBeVisible();
    await expect(page.getByText("Tap the Share button, then Add to Home Screen.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Turn on notifications" })).toHaveCount(0);
  });
});

test.describe("polish and account", () => {
  const rest = async (token: string, path: string, method = "GET", body?: unknown) => {
    const r = await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/${path}`, {
      method, headers: { apikey: process.env.E2E_SUPABASE_KEY!, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r;
  };

  async function user() {
    const email = `e2e-${crypto.randomUUID()}@test.local`;
    const r = await fetch(`${process.env.E2E_SUPABASE_URL}/auth/v1/signup`, {
      method: "POST", headers: { apikey: process.env.E2E_SUPABASE_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }),
    });
    const j = await r.json();
    return { email, token: j.access_token as string, id: j.user.id as string };
  }

  async function login(page: Page, email: string, hash: string, skip = true) {
    await page.goto(`#/${hash}`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    if (skip) await page.getByRole("button", { name: "Skip for now" }).click();
  }

  async function withHistory(u: { token: string }) {
    await rest(u.token, "bodyweight_entries", "POST", { measured_on: "2026-01-01", weight_kg: 80 });
    const sid = crypto.randomUUID();
    const t0 = Date.now() - 3 * 86_400_000;
    await rest(u.token, "sessions", "POST", { id: sid, started_at: new Date(t0).toISOString(), ended_at: new Date(t0 + 3_600_000).toISOString() });
    await rest(u.token, "session_sets", "POST", [
      { id: crypto.randomUUID(), session_id: sid, exercise_ref: "ds:Barbell_Curl", round_index: 0, set_number: 1, weight_kg: 40, reps: 10, is_warmup: false, completed_at: new Date(t0).toISOString() },
      { id: crypto.randomUUID(), session_id: sid, exercise_ref: "ds:Barbell_Curl", round_index: 1, set_number: 2, weight_kg: 42.5, reps: 8, is_warmup: false, completed_at: new Date(t0 + 60_000).toISOString() },
    ]);
  }

  test("exercise sheet shows muscles on a figure and your history, with no routine controls", async ({ page }) => {
    const u = await user();
    await withHistory(u);
    await login(page, u.email, "library/ds%3ABarbell_Curl");
    const sheet = page.getByRole("dialog", { name: "Barbell Curl" });
    await expect(sheet.getByRole("img", { name: /Muscles worked: Biceps \(primary\)/ })).toBeVisible();
    await expect(sheet.getByText(/Best estimated 1RM:/)).toBeVisible();
    await expect(sheet).toContainText("53.8 kg"); // 42.5 x 8 -> 53.8, above 40 x 10 -> 53.3
    await expect(sheet.getByRole("heading", { name: "Routine" })).toHaveCount(0);
  });

  test("tells you when you are offline and what still works", async ({ page, context }) => {
    const u = await user();
    await login(page, u.email, "dashboard");
    await expect(page.getByText("You're offline")).toHaveCount(0);
    await context.setOffline(true);
    await expect(page.getByText(/You're offline\. Sets you log are saved on this device/)).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText("You're offline")).toHaveCount(0);
  });

  test("About credits the exercise dataset", async ({ page }) => {
    const u = await user();
    await login(page, u.email, "settings");
    await page.getByRole("link", { name: "About Tempered" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible();
    await expect(page.getByRole("link", { name: "free-exercise-db" })).toHaveAttribute("href", "https://github.com/yuhonas/free-exercise-db");
    await expect(page.getByText("Unlicense")).toBeVisible();
  });

  test("exports sets as CSV in kilograms", async ({ page }) => {
    const u = await user();
    await withHistory(u);
    await login(page, u.email, "settings");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export sets (CSV)" }).click();
    const file = await download;
    const fs = await import("node:fs/promises");
    const text = await fs.readFile((await file.path())!, "utf8");
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toContain("exercise,round,set_number,weight_kg,reps");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Barbell Curl,1,1,40,10");
    expect(file.suggestedFilename()).toMatch(/^tempered-sets-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test("deleting the account needs the email typed back, then removes everything", async ({ page }) => {
    const u = await user();
    await withHistory(u);
    await login(page, u.email, "settings");
    await page.getByText("Delete my account and data").click();
    const del = page.getByRole("button", { name: "Delete account and all data" });
    await expect(del).toBeDisabled();
    await page.getByLabel(/Type your email/).fill("someone@else.com");
    await expect(del).toBeDisabled();
    await page.getByLabel(/Type your email/).fill(u.email.toUpperCase());
    await expect(del).toBeEnabled();
    await del.click();
    await expect(page.getByRole("heading", { name: "Tempered" })).toBeVisible(); // signed out
    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(/invalid/i);
    // The old token no longer reads anything.
    const r = await rest(u.token, "session_sets?select=id");
    expect([401, 403, 200]).toContain(r.status);
    if (r.status === 200) expect(await r.json()).toEqual([]);
  });
});
