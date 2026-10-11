/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
    plugins: [
      react(),
      csp(env.VITE_SUPABASE_URL ?? ""),
      VitePWA({
        strategies: "injectManifest", // a custom worker: it also handles push
        srcDir: "src",
        filename: "sw.ts",
        injectRegister: false, // registered in main.tsx so the CSP stays free of inline scripts
        manifest: {
          name: "Tempered",
          short_name: "Tempered",
          description: "A personal gym tracker.",
          theme_color: "#F5F5F7",
          background_color: "#F5F5F7",
          display: "standalone",
          orientation: "portrait",
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        injectManifest: { globPatterns: ["**/*.{js,css,html,woff2,png,svg}"], maximumFileSizeToCacheInBytes: 3_000_000 },
      }),
    ],
    test: { include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"] },
  };
});
