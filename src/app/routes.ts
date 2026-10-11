import { useSyncExternalStore } from "react";

export const TABS = [
  { id: "dashboard", label: "Dashboard", hint: "Log your first session to start ranking." },
  { id: "log", label: "Session", hint: "Start a session from your active routine." },
  { id: "routines", label: "Routines", hint: "Build a weekly routine to plan your sessions." },
  { id: "library", label: "Exercises", hint: "Search exercises and see how to perform them." },
] as const;

export type TabId = (typeof TABS)[number]["id"];

// Settings opens from the header, not the tab bar.
export const SETTINGS = { id: "settings", label: "Settings", hint: "" } as const;
export type Route = (typeof TABS)[number] | typeof SETTINGS;

/** "#/log" -> "log". Anything unknown falls back to the dashboard. */
export function parseHash(hash: string): Route["id"] {
  const id = hash.replace(/^#\/?/, "").split("/")[0];
  return [...TABS, SETTINGS].find((t) => t.id === id)?.id ?? "dashboard";
}

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export const useRoute = () => parseHash(useSyncExternalStore(subscribe, () => location.hash));

/** Second hash segment, decoded: "#/library/ds%3ABarbell_Curl" -> "ds:Barbell_Curl". */
export const useRouteArg = (): string | null => {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  const arg = hash.replace(/^#\/?/, "").split("/")[1];
  try {
    return arg ? decodeURIComponent(arg) : null;
  } catch {
    return null;
  }
};
