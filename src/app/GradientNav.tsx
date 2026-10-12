// Port of cult-ui's GradientButtonGroup: a layered tray of icon links with an animated active ring and a theme toggle.
// Wired to the app's hash routes instead of local state, and to the app's theme setting instead of next-themes.
import { motion, useReducedMotion } from "motion/react";
import { TabIcon } from "./icons";
import type { Theme } from "./theme";
import type { TabId } from "./routes";
import s from "./GradientNav.module.css";

export { NEXT as NEXT_THEME };
export type NavTab = { readonly id: TabId; readonly label: string };

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const THEME_LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

function ThemeIcon({ theme }: { theme: Theme }) {
  const p = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, "aria-hidden": true };
  if (theme === "system")
    return (
      <svg {...p}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    );
  if (theme === "light")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function ProfileDock({ current }: { current: boolean }) {
  return (
    <div className={`${s.profileDock} ${s.themed}`}>
      <div className={s.profileTray}>
        <a href="#/settings" className={s.profile} aria-label="Settings" aria-current={current ? "page" : undefined}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="9" r="3.5" />
            <path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5" />
          </svg>
        </a>
      </div>
    </div>
  );
}

export function GradientNav({ tabs, active, theme, onCycleTheme }: { tabs: readonly NavTab[]; active: string; theme: Theme; onCycleTheme: () => void }) {
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 400, damping: 30 };
  return (
    <div className={`${s.dock} ${s.themed}`}>
      <div className={s.tray}>
        <div className={s.bezel} />
        <nav className={s.nav} aria-label="Main">
          {tabs.map((t) => {
            const on = t.id === active;
            return (
              <a key={t.id} href={`#/${t.id}`} className={s.item} aria-label={t.label} aria-current={on ? "page" : undefined} data-active={on}>
                {on && (
                  <>
                    <motion.span layoutId="nav-well" className={s.well} transition={spring} />
                    <motion.span layoutId="nav-ring" className={s.ring} transition={spring}>
                      <span className={s.spin} />
                    </motion.span>
                    <motion.span layoutId="nav-gap" className={s.gap} transition={spring} />
                  </>
                )}
                <span className={s.face}>
                  <TabIcon id={t.id} />
                </span>
              </a>
            );
          })}
        </nav>
        <button
          type="button"
          className={s.toggle}
          onClick={onCycleTheme}
          aria-label={`Theme: ${THEME_LABEL[theme]}. Change to ${THEME_LABEL[NEXT[theme]].toLowerCase()}`}
        >
          <ThemeIcon theme={theme} />
        </button>
      </div>
    </div>
  );
}
