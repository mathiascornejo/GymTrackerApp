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
