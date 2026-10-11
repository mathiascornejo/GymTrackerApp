import type { ReactNode } from "react";
import { TabIcon } from "./icons";
import { TABS, useTab } from "./routes";
import { useTheme, type Theme } from "./theme";
import s from "./Shell.module.css";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

function ThemeControl() {
  const [theme, setTheme] = useTheme();
  return (
    <div className={s.theme} role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className={s.themeOption} onClick={() => setTheme(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: (tab: (typeof TABS)[number]) => ReactNode }) {
  const active = useTab();
  const tab = TABS.find((t) => t.id === active)!;
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
          <h1 className={s.title}>{tab.label}</h1>
          <ThemeControl />
        </header>
        <main className={s.main}>{children(tab)}</main>
      </div>
    </div>
  );
}
