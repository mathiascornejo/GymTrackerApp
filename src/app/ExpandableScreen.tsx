// Port of cult-ui's ExpandableScreen (Motion shared-layout morph) to this app's CSS Modules.
// Differences: a native <dialog> supplies focus trapping and Escape, `expanded` can be controlled, and when no
// trigger shares the layoutId the screen grows from wherever the user last clicked.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import s from "./ExpandableScreen.module.css";

type Ctx = {
  isExpanded: boolean;
  expand: () => void;
  collapse: () => void;
  layoutId: string;
  triggerRadius: string;
  contentRadius: string;
  animationDuration: number;
};

const ExpandableScreenContext = createContext<Ctx | null>(null);

export function useExpandableScreen() {
  const ctx = useContext(ExpandableScreenContext);
  if (!ctx) throw new Error("useExpandableScreen must be used within an ExpandableScreen");
  return ctx;
}

// Where the last click landed, so a popup opened from any button can grow out of it.
let lastClick: DOMRect | null = null;
if (typeof document !== "undefined")
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target instanceof Element ? e.target.closest("button, a, [role=button], label, li, summary") ?? e.target : null;
      lastClick = el ? el.getBoundingClientRect() : null;
    },
    true,
  );

export function ExpandableScreen({
  children,
  expanded,
  defaultExpanded = false,
  onExpandChange,
  layoutId = "expandable-card",
  triggerRadius = "100px",
  contentRadius = "28px",
  animationDuration = 0.3,
}: {
  children: ReactNode;
  /** Controlled state; omit to let the component manage it. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  layoutId?: string;
  triggerRadius?: string;
  contentRadius?: string;
  animationDuration?: number;
}) {
  const [inner, setInner] = useState(defaultExpanded);
  const isExpanded = expanded ?? inner;
  const set = (v: boolean) => {
    if (expanded === undefined) setInner(v);
    onExpandChange?.(v);
  };
  return (
    <ExpandableScreenContext.Provider
      value={{ isExpanded, expand: () => set(true), collapse: () => set(false), layoutId, triggerRadius, contentRadius, animationDuration }}
    >
      {children}
    </ExpandableScreenContext.Provider>
  );
}

export function ExpandableScreenTrigger({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { isExpanded, expand, layoutId, triggerRadius } = useExpandableScreen();
  return (
    <AnimatePresence initial={false}>
      {!isExpanded && (
        <motion.div className={`${s.trigger} ${className}`}>
          <motion.div style={{ borderRadius: triggerRadius }} layout layoutId={layoutId} className={s.triggerBg} />
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            exit={{ opacity: 0, scale: 0.8 }}
            layout={false}
            onClick={expand}
            className={s.triggerBody}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ExpandableScreenContent({
  children,
  label,
  className = "",
  showCloseButton = true,
}: {
  children: ReactNode;
  /** Accessible name of the dialog. */
  label: string;
  className?: string;
  showCloseButton?: boolean;
}) {
  const { isExpanded, collapse, layoutId, contentRadius, animationDuration } = useExpandableScreen();
  const reduce = useReducedMotion();
  const dialog = useRef<HTMLDialogElement>(null);
  const origin = useRef<{ x: number; y: number; scale: number } | null>(null);

  if (isExpanded && !origin.current) {
    const r = lastClick;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    origin.current = r
      ? { x: r.left + r.width / 2 - vw / 2, y: r.top + r.height / 2 - vh / 2, scale: Math.min(1, Math.max(0.05, r.width / Math.min(520, vw - 32))) }
      : { x: 0, y: 0, scale: 0.92 };
  }
  if (!isExpanded) origin.current = null;

  useEffect(() => {
    const d = dialog.current;
    if (isExpanded && d && !d.open) d.showModal();
  }, [isExpanded]);

  const from = { opacity: 0, x: origin.current?.x ?? 0, y: origin.current?.y ?? 0, scale: origin.current?.scale ?? 0.92, borderRadius: "999px" };
  const duration = reduce ? 0 : animationDuration;

  return (
    <dialog
      ref={dialog}
      className={s.screen}
      aria-label={label}
      onClose={collapse}
      onClick={(e) => e.target === dialog.current && collapse()}
    >
      <AnimatePresence initial={false} onExitComplete={() => dialog.current?.open && dialog.current.close()}>
        {isExpanded && (
          <motion.div
            key={layoutId}
            data-layout-id={layoutId}
            className={`${s.panel} ${className}`}
            initial={from}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1, borderRadius: contentRadius }}
            exit={from}
            transition={{ duration, ease: [0.32, 0.72, 0, 1] }}
          >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.15, duration: reduce ? 0 : 0.3 }} className={s.body}>
              {children}
            </motion.div>
            {showCloseButton && (
              <button type="button" className={s.close} aria-label="Close" onClick={collapse}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}
