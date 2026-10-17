// Port of cult-ui's GradientButtonGroup: a layered tray of icon links with an animated active ring.
// Wired to the app's hash routes instead of local state. Theme lives in Settings, not here, so the tray holds only tabs.
import { motion, useReducedMotion } from "motion/react";
import { TabIcon } from "./icons";
import type { TabId } from "./routes";
import s from "./GradientNav.module.css";

export type NavTab = { readonly id: TabId; readonly label: string };

export function ProfileDock({ current }: { current: boolean }) {
  return (
    <div className={`${s.profileDock} ${s.themed}`}>
      <div className={s.profileTray}>
        <div className={s.profileInner}>
          <a href="#/settings" className={s.item} aria-label="Settings" aria-current={current ? "page" : undefined} data-active={current}>
            {current && (
              <>
                <span className={s.well} />
                <span className={s.ring}>
                  <span className={s.spin} />
                </span>
                <span className={s.gap} />
              </>
            )}
            <span className={s.face}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="9" r="3.5" />
                <path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function GradientNav({ tabs, active }: { tabs: readonly NavTab[]; active: string }) {
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 400, damping: 30 };
  return (
    // layoutRoot: the dock is position: fixed, so the ring's layout animation must ignore page scroll (switching tabs resets it).
    <motion.div layoutRoot className={`${s.dock} ${s.themed}`}>
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
      </div>
    </motion.div>
  );
}
