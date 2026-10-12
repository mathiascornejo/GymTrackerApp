import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "correct-horse-battery";
const REST = (path: string) => `${process.env.E2E_SUPABASE_URL}/rest/v1/${path}`;

async function seed() {
  const email = `a11y-${crypto.randomUUID()}@test.local`;
  const r = await fetch(`${process.env.E2E_SUPABASE_URL}/auth/v1/signup`, {
    method: "POST", headers: { apikey: process.env.E2E_SUPABASE_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }),
  });
  const j = await r.json();
  const h = { apikey: process.env.E2E_SUPABASE_KEY!, Authorization: `Bearer ${j.access_token}`, "Content-Type": "application/json" };
  const post = (p: string, b: unknown, m = "POST") => fetch(REST(p), { method: m, headers: h, body: JSON.stringify(b) });
  await post(`profiles?id=eq.${j.user.id}`, { standards_table: "male" }, "PATCH");
  await post("bodyweight_entries", { measured_on: "2026-01-01", weight_kg: 80 });
  const sid = crypto.randomUUID();
  const start = new Date(Date.now() - 2 * 86_400_000);
  await post("sessions", { id: sid, started_at: start.toISOString(), ended_at: new Date(start.getTime() + 3_600_000).toISOString() });
  await post("session_sets", ["Barbell_Bench_Press_-_Medium_Grip", "Barbell_Squat", "Barbell_Curl"].map((ref, i) => ({
    id: crypto.randomUUID(), session_id: sid, exercise_ref: `ds:${ref}`, round_index: 0, set_number: 1, weight_kg: 60 + i * 20, reps: 8,
    is_warmup: false, completed_at: new Date(start.getTime() + i * 60_000).toISOString(),
  })));
  return email;
}

async function signIn(page: Page, email: string, hash: string) {
  await page.goto(`#/${hash}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

const screens = [
  ["dashboard", "Dashboard"],
  ["log", "Session"],
  ["routines", "Routines"],
  ["library", "Exercises"],
  ["weight", "Weight"],
  ["settings", "Settings"],
] as const;

const scan = async (page: Page) => {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
};

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test("open sheets and dialogs have no violations", async ({ page }) => {
      const email = await seed();
      await signIn(page, email, "library/ds%3ABarbell_Curl");
      await expect(page.getByRole("dialog", { name: "Barbell Curl" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await scan(page), "exercise sheet").toEqual([]);

      await page.goto("#/dashboard");
      await page.getByRole("button", { name: /^Chest, .*Show details/ }).click();
      await expect(page.getByRole("dialog", { name: "Chest" })).toBeVisible();
      expect(await scan(page), "muscle sheet").toEqual([]);

      await page.keyboard.press("Escape");
      await page.goto("#/log");
      await page.getByRole("button", { name: "Start quick session" }).click();
      await page.getByRole("button", { name: "Add exercise" }).click();
      await expect(page.getByRole("dialog", { name: "Add exercise" })).toBeVisible();
      expect(await scan(page), "add exercise sheet").toEqual([]);
    });

    test("sign-in screen has no violations", async ({ page }) => {
      await page.goto("");
      await expect(page.getByRole("heading", { name: "Tempered" })).toBeVisible();
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    });

    for (const [hash, heading] of screens) {
      test(`${heading} has no violations`, async ({ page }) => {
        const email = await seed();
        await signIn(page, email, hash);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        // Let data-backed sections render before scanning.
        await page.waitForLoadState("networkidle");
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
      });
    }
  });
}

test.describe("motion and touch", () => {
  test("reduced motion runs no CSS animation on the demo", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const email = await seed();
    await signIn(page, email, "library/ds%3ABarbell_Curl");
    const imgs = page.getByRole("dialog", { name: "Barbell Curl" }).locator("img");
    await expect(imgs).toHaveCount(1);
    const running = await page.evaluate(() => document.getAnimations().filter((x) => x.playState === "running" && (x.effect as KeyframeEffect | null)?.target?.tagName === "IMG").length);
    expect(running).toBe(0);
  });

  test("interactive controls are at least 44px tall on a phone", async ({ page }, info) => {
    test.skip(info.project.name !== "phone", "Touch target size is a phone concern.");
    const email = await seed();
    await signIn(page, email, "settings");
    const small: string[] = [];
    for (const hash of ["dashboard", "log", "routines", "library", "weight", "settings"]) {
      await page.goto(`#/${hash}`);
      await page.waitForLoadState("networkidle");
      const found = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("button, select, summary, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), [role=button], nav a")]
          .filter((el) => !(el instanceof SVGElement)) // body-map regions: the list view is their full-size alternative
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !el.closest("[aria-hidden=true]") && r.height < 43.5;
          })
          .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`),
      );
      found.forEach((f) => small.push(`${hash}: ${f}`));
    }
    expect(small).toEqual([]);
  });
});
