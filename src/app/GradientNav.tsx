// Port of cult-ui's GradientButtonGroup: a layered tray of icon links with an animated active ring and a theme toggle.
// Wired to the app's hash routes instead of local state, and to the app's theme setting instead of next-themes.
import { motion, useReducedMotion } from "motion/react";
import { TabIcon } from "./icons";
import type { TabId } from "./routes";
import s from "./GradientNav.module.css";

export type NavTab = { readonly id: TabId; readonly label: string };

export function GradientNav({ tabs, active, dark, onToggleTheme }: { tabs: readonly NavTab[]; active: string; dark: boolean; onToggleTheme: () => void }) {
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 400, damping: 30 };
  return (
    <div className={s.dock}>
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
        <button type="button" className={s.toggle} onClick={onToggleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
          {dark ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
