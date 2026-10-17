/// <reference lib="webworker" />
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// The app shell, built assets (including the exercise dataset chunk) and fonts are precached: the log works offline.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// A new worker takes over straight away. Without this it waits for every tab to close, so a reload kept showing the old build.
self.addEventListener("install", () => void self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${import.meta.env.BASE_URL}index.html`)));

// Demonstration images come from jsDelivr pinned to a dataset commit, so cached copies never go stale.
registerRoute(
  ({ url }) => url.hostname === "cdn.jsdelivr.net",
  new CacheFirst({ cacheName: "exercise-images", plugins: [new ExpirationPlugin({ maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 365 })] }),
);

type PushPayload = { title?: string; body?: string; tag?: string; fireAt?: string; url?: string };

self.addEventListener("push", (event) => {
  let data: PushPayload = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    /* a push with no JSON still gets a notification */
  }
  const receivedAt = Date.now();
  // iOS requires every push to show a notification, so this never suppresses one, even with the app in front.
  const show = self.registration.showNotification(data.title ?? "Rest Done", {
    body: data.body ?? "Time for your next set.",
    tag: data.tag,
    icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
    data: { url: data.url ?? `${import.meta.env.BASE_URL}#/log` },
  });
  // Lets Settings show how late the last background alarm was (against the timer's own fire time).
  const diag = caches
    .open("tempered-diag")
    .then((c) => c.put("last-alarm", new Response(JSON.stringify({ fireAt: data.fireAt ?? null, receivedAt }))));
  event.waitUntil(Promise.all([show, diag]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? `${import.meta.env.BASE_URL}#/log`, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const open = clients.find((c) => c.url.startsWith(self.registration.scope));
      if (open) {
        await open.focus();
        await open.navigate(target);
      } else {
        await self.clients.openWindow(target);
      }
    }),
  );
});
