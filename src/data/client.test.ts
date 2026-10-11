import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// CI builds without secrets pass empty strings; the module must still load so the setup screen can render.
it("loads and reports unconfigured when the env vars are empty strings", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  const client = await import("./client");
  expect(client.configured).toBe(false);
});
