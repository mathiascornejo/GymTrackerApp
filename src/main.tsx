import { StrictMode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/space-grotesk/wght.css";
import "./styles/tokens.css";
import "./styles/global.css";
import { App } from "./app/App";
import { queryClient } from "./data/queryClient";
import { installTouchScrollbars } from "./app/touchScrollbars";

installTouchScrollbars();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// The worker precaches the app and carries the push handler. Production only: it would fight the dev server.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        // Look for a new build when the app comes back to the foreground, not only on a full load.
        document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void reg.update());
      })
      .catch(() => {
        /* unsupported or blocked: the app works without it, just not offline or with background alarms */
      });
  });

  // When a new build takes over, reload once so the page runs it. The first install has no controller yet and is left alone.
  if (navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }
}
