import { useCallback, useState } from "react";

export type Theme = "system" | "light" | "dark";

// Keep the key in sync with public/theme-init.js. Phase 2 moves this into the profile.
const KEY = "tempered.theme";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* private mode: the choice lasts for this page load only */
  }
}

export function useTheme() {
  const [theme, set] = useState<Theme>(read);
  const setTheme = useCallback((t: Theme) => {
    applyTheme(t);
    set(t);
  }, []);
  return [theme, setTheme] as const;
}
