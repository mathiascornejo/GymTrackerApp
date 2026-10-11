import { execSync } from "node:child_process";
import { defineConfig } from "@playwright/test";

// e2e runs against the local Supabase stack (`npx supabase start`).
const status = Object.fromEntries(
  execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .map((l) => l.match(/^(\w+)="?([^"]*)"?$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => [m[1], m[2]]),
);
process.env.E2E_SUPABASE_URL = status.API_URL;
process.env.E2E_SUPABASE_KEY = status.PUBLISHABLE_KEY;

export default defineConfig({
  testDir: "tests",
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173/GymTrackerApp/",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: status.API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY },
  },
  use: { baseURL: "http://localhost:4173/GymTrackerApp/" },
  projects: [
    { name: "phone", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
