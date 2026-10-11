import { expect, test } from "@playwright/test";

const tabs = [
  ["dashboard", "Dashboard"],
  ["log", "Session"],
  ["routines", "Routines"],
  ["library", "Exercises"],
];

for (const [id, label] of tabs) {
  test(`${label} tab shows only its own content`, async ({ page }) => {
    await page.goto(`#/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    // no horizontal scroll at 360px-class widths
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("production build ships a CSP meta tag", async ({ page }) => {
  await page.goto("#/dashboard");
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("script-src 'self'");
});

test("theme choice persists across reload", async ({ page }) => {
  await page.goto("#/dashboard");
  await page.getByRole("radio", { name: "Dark" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
