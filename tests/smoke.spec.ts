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
      await page.getByRole("button", { name: "Done" }).click();
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
