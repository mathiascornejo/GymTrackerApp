import { useSyncExternalStore } from "react";

export const TABS = [
  { id: "dashboard", label: "Dashboard", hint: "Log your first session to start ranking." },
  { id: "log", label: "Session", hint: "Start a session from your active routine." },
  { id: "routines", label: "Routines", hint: "Build a weekly routine to plan your sessions." },
  { id: "library", label: "Exercises", hint: "Search exercises and see how to perform them." },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/** "#/log" -> "log". Anything unknown falls back to the dashboard. */
export function parseHash(hash: string): TabId {
  const id = hash.replace(/^#\/?/, "").split("/")[0];
  return TABS.find((t) => t.id === id)?.id ?? "dashboard";
}

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export const useTab = (): TabId => parseHash(useSyncExternalStore(subscribe, () => location.hash));
