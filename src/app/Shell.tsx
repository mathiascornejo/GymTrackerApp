import type { ReactNode } from "react";
import { useUpdateProfile } from "../data/profile";
import { GradientNav, NEXT_THEME, ProfileDock } from "./GradientNav";
import { ABOUT, SETTINGS, TABS, useRoute, type Route } from "./routes";
import { OfflineNotice } from "./OfflineNotice";
import { useTheme } from "./theme";
import s from "./Shell.module.css";

export function Shell({ children }: { children: (route: Route) => ReactNode }) {
  const active = useRoute();
  const [theme, setTheme] = useTheme();
  const save = useUpdateProfile();
  const cycle = () => {
    const next = NEXT_THEME[theme];
    setTheme(next);
    save.mutate({ theme: next });
  };
  const route = [...TABS, SETTINGS, ABOUT].find((t) => t.id === active)!;
  return (
    <div className={s.shell}>
      <GradientNav tabs={TABS} active={active} theme={theme} onCycleTheme={cycle} />
      <ProfileDock current={active === "settings"} />
      <div className={s.body}>
        <header className={s.header}>
          <h1 className={s.title}>{route.label}</h1>
        </header>
        <main className={s.main}>
          <OfflineNotice />
          {children(route)}
        </main>
      </div>
    </div>
  );
}
