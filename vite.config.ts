/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// CSP is a <meta> tag (GitHub Pages sends no headers). Build only: the dev server needs inline HMR scripts.
// style-src needs 'unsafe-inline' because React/motion write style attributes.
function csp(supabaseUrl: string): Plugin {
  const connect = ["'self'", supabaseUrl].filter(Boolean).join(" ");
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: https://cdn.jsdelivr.net`,
    "font-src 'self'",
    `connect-src ${connect}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head-prepend" },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  return {
    base: "/GymTrackerApp/",
    plugins: [react(), csp(env.VITE_SUPABASE_URL ?? "")],
    test: { include: ["src/**/*.test.ts"] },
  };
});
