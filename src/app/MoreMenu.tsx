import { useEffect, useId, useRef, useState } from "react";
import f from "./Form.module.css";
import s from "./Routines.module.css";

export type MenuItem = { label: string; onSelect: () => void; destructive?: boolean };

/** A menu button (WAI-ARIA menu pattern): arrows move, Escape closes, focus returns to the button. */
export function MoreMenu({
  label, items, trigger, className, up,
}: {
  label: string;
  items: MenuItem[];
  /** What the button shows when it should not read as `label` (an icon, or a shorter word); `label` is then its accessible name. */
  trigger?: React.ReactNode;
  className?: string;
  /** Open above the button, for menus near the bottom of a card. */
  up?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const els = [...menu.current!.querySelectorAll<HTMLElement>("[role=menuitem]")];
    const i = els.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      els[(n + els.length) % els.length].focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(els.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div className={s.menuWrap}>
      <button
        ref={btn} type="button" className={className ?? f.quiet} aria-label={trigger ? label : undefined} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        {trigger ?? label}
      </button>
      {open && (
        <div ref={menu} id={id} role="menu" aria-label={label} className={`${s.menu} ${up ? s.menuUp : ""}`} onKeyDown={onKey}>
          {items.map((it) => (
            <button
              key={it.label} type="button" role="menuitem" tabIndex={-1} className={`${s.menuItem} ${it.destructive ? s.menuDanger : ""}`}
              onClick={() => {
                close();
                it.onSelect();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
