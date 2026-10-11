import type { ReactNode } from "react";
import { useUpdateProfile } from "../data/profile";
import { TabIcon } from "./icons";
import { SETTINGS, TABS, useRoute, type Route } from "./routes";
import { useTheme, type Theme } from "./theme";
import s from "./Shell.module.css";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function ThemeControl() {
  const [theme, setTheme] = useTheme();
  const save = useUpdateProfile();
  const choose = (t: Theme) => {
    setTheme(t);
    save.mutate({ theme: t });
  };
  return (
    <div className={s.theme} role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className={s.themeOption} onClick={() => choose(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: (route: Route) => ReactNode }) {
  const active = useRoute();
  const route = [...TABS, SETTINGS].find((t) => t.id === active)!;
  return (
    <div className={s.shell}>
      <nav className={s.nav} aria-label="Main">
        {TABS.map((t) => (
          <a key={t.id} href={`#/${t.id}`} className={s.link} aria-current={t.id === active ? "page" : undefined}>
            <TabIcon id={t.id} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <div className={s.body}>
        <header className={s.header}>
          <h1 className={s.title}>{route.label}</h1>
          <div className={s.tools}>
            <ThemeControl />
            <a href="#/settings" className={s.profile} aria-label="Settings" aria-current={active === "settings" ? "page" : undefined}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="9" r="3.5" />
                <path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5" />
              </svg>
            </a>
          </div>
        </header>
        <main className={s.main}>{children(route)}</main>
      </div>
    </div>
  );
}
