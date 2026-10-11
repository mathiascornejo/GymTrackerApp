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

async function signIn(page: Page, hash = "dashboard") {
  const email = await newUser();
  await page.goto(`#/${hash}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
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
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/invalid/i);
});

test("theme choice is saved to the profile and survives a fresh browser", async ({ page, browser }) => {
  await signInAndSkipSetup(page);
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.waitForLoadState("networkidle"); // the profile save is a background request
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // Same account, empty localStorage: the profile has to supply the theme.
  const state = await page.context().storageState();
  state.origins = state.origins.map((o) => ({ ...o, localStorage: o.localStorage.filter((i) => i.name.startsWith("sb-")) }));
  const ctx = await browser.newContext({ storageState: state, baseURL: "http://localhost:4173/GymTrackerApp/" });
  const other = await ctx.newPage();
  await other.goto("#/dashboard");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
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
  await page.getByLabel("Week starts on").selectOption("0");
  await page.getByLabel("Start rest after each set").check();
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
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete exercise" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: /Neck harness curl/ })).toHaveCount(0);
  });
});

test.describe("routine builder", () => {
  const isPhone = () => test.info().project.name === "phone";

  async function openBuilder(page: Page) {
    await signInAndSkipSetup(page, "routines");
    await page.getByRole("button", { name: "New routine" }).click();
    await expect(page.getByLabel("Name")).toHaveValue("New routine");
  }

  // The picker is docked on desktop and a bottom sheet on phone; either way it exposes the same "Add to" menu.
  async function addExercise(page: Page, name: string, to: string) {
    if (isPhone()) {
      await page.getByRole("button", { name: "Add exercise" }).click();
      await page.getByLabel("Search the picker").fill(name);
      await page.getByLabel(`Add ${name} to`, { exact: true }).selectOption({ label: to });
      await page.getByRole("button", { name: "Done", exact: true }).click();
    } else {
      await page.getByLabel("Search the picker").fill(name);
      await page.getByLabel(`Add ${name} to`, { exact: true }).selectOption({ label: to });
    }
  }

  const showDay = async (page: Page, day: string) => {
    if (isPhone()) await page.getByRole("tab", { name: day.slice(0, 3) === "Ban" ? "Bank" : day.slice(0, 3) }).click();
  };

  test("adds an exercise, edits sets, and keeps it after reload", async ({ page }) => {
    await openBuilder(page);
    await addExercise(page, "Barbell Curl", "Monday");
    await showDay(page, "Monday");
    const card = page.getByRole("article", { name: "Barbell Curl" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Increase Sets" }).click();
    await expect(card.getByRole("group", { name: "Sets" }).getByRole("status")).toHaveText("4");
    await card.getByRole("button", { name: "Increase Rest" }).click();
    await expect(card.getByRole("group", { name: "Rest" }).getByRole("status")).toHaveText("1:45");

    await expect(page.getByText("All changes saved")).toBeVisible();
    await page.reload();
    await showDay(page, "Monday");
    const again = page.getByRole("article", { name: "Barbell Curl" });
    await expect(again.getByRole("group", { name: "Sets" }).getByRole("status")).toHaveText("4");
    await expect(page.getByRole("region", { name: "Weekly sets per muscle" })).toContainText("Biceps");
  });

  test("links a push/pull superset, then unlinks it", async ({ page }) => {
    await openBuilder(page);
    await addExercise(page, "Barbell Curl", "Monday");
    await addExercise(page, "Barbell Bench Press - Medium Grip", "Monday");
    await showDay(page, "Monday");
    await page.getByLabel("Select Barbell Curl to link").check();
    await page.getByLabel("Select Barbell Bench Press - Medium Grip to link").check();
    await page.getByRole("button", { name: "Link as superset" }).click();
    const card = page.getByRole("article", { name: /Barbell Curl and Barbell Bench Press|Barbell Bench Press - Medium Grip and Barbell Curl/ });
    await expect(card.getByText("Superset", { exact: true })).toBeVisible();
    await expect(card.getByText("Push/pull pair")).toBeVisible();
    await card.getByRole("button", { name: "Unlink" }).click();
    await expect(page.getByRole("article")).toHaveCount(2);
  });

  test("bank blocks count seven days of volume and Move to relocates a card", async ({ page }) => {
    await openBuilder(page);
    await addExercise(page, "Standing Calf Raises", "Accessory bank");
    await showDay(page, "Bank");
    await expect(page.getByRole("region", { name: "Weekly sets per muscle" })).toContainText(/Calves\s*21/);
    const card = page.getByRole("article", { name: "Standing Calf Raises" });
    await card.getByLabel("Schedule").selectOption("week");
    await expect(page.getByRole("region", { name: "Weekly sets per muscle" })).toContainText(/Calves\s*6/);
    await card.getByLabel("Move Standing Calf Raises to").selectOption({ label: "Wednesday" });
    await showDay(page, "Wednesday");
    await expect(page.getByRole("article", { name: "Standing Calf Raises" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Weekly sets per muscle" })).toContainText(/Calves\s*3/);
  });

  test("exports a routine and imports it back, and rejects a bad file with reasons", async ({ page }) => {
    await openBuilder(page);
    await addExercise(page, "Barbell Curl", "Monday");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
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
    await page.getByRole("button", { name: "New routine" }).click();
    await page.getByRole("button", { name: "Make active" }).click();
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

  test("drags an exercise from the picker onto a day", async ({ page }) => {
    test.skip(isPhone(), "Drag from the docked picker is a desktop interaction; phone uses the Add to menu.");
    await openBuilder(page);
    await page.getByLabel("Search the picker").fill("Barbell Curl");
    const source = page.getByRole("listitem").filter({ hasText: "Barbell Curl" }).first().locator("div").first();
    const target = page.getByRole("region", { name: "Tuesday" });
    const a = (await source.boundingBox())!;
    const b = (await target.boundingBox())!;
    await page.mouse.move(a.x + 20, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + 40, a.y + a.height / 2 - 20, { steps: 5 });
    await page.mouse.move(b.x + b.width / 2, b.y + 60, { steps: 12 });
    await page.mouse.up();
    await expect(target.getByRole("article", { name: "Barbell Curl" })).toBeVisible();
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
    await page.getByRole("button", { name: "Make active" }).click();
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
