import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  webServer: { command: "npm run build && npm run preview", url: "http://localhost:4173/GymTrackerApp/", reuseExistingServer: true, timeout: 120_000 },
  use: { baseURL: "http://localhost:4173/GymTrackerApp/" },
  projects: [
    { name: "phone", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
