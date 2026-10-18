// Touch screens (iOS above all) ignore scrollbar styling, so scroll boxes draw their own thin accent bar.
// A box opts in with a data-thumb attribute. Its bar is a sticky ::before inside the box (see global.css), so it moves with the box
// and is clipped by it. This file sets the bar's size and travel; the bar's position comes from the browser where it can:
//  - browsers with scroll-driven animations move it on the compositor from the box's scroll position (no JavaScript per frame);
//  - elsewhere the scroll handler sets one transform offset synchronously, which is cheap and never waits for a frame.
// The page itself gets no bar on touch screens.

const TOUCH = "(hover: none) and (pointer: coarse)";
const MIN = 28;
const INSET = 4;

export function installTouchScrollbars() {
  if (!window.matchMedia(TOUCH).matches) return;

  const native = CSS.supports("animation-timeline", "scroll()");

  const size = (el: HTMLElement) => {
    const viewH = el.clientHeight;
    const total = el.scrollHeight;
    if (total <= viewH + 1) {
      el.style.setProperty("--th-h", "0px");
      return;
    }
    const track = viewH - 2 * INSET;
    const h = Math.max(MIN, (viewH / total) * track);
    el.style.setProperty("--th-h", `${h}px`);
    el.style.setProperty("--th-travel", `${track - h}px`);
  };

  // Clamped, because overscroll bounce takes scrollTop below 0 and past the end.
  const move = (el: HTMLElement) => {
    const range = el.scrollHeight - el.clientHeight;
    const travel = el.clientHeight - 2 * INSET - Math.max(MIN, (el.clientHeight / el.scrollHeight) * (el.clientHeight - 2 * INSET));
    const p = range > 0 ? Math.min(1, Math.max(0, el.scrollTop / range)) : 0;
    el.style.setProperty("--th-t", `${p * travel}px`);
  };

  const boxes = () => document.querySelectorAll<HTMLElement>("[data-thumb]");

  let queued = false;
  const sync = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      boxes().forEach((el) => {
        size(el);
        if (!native) move(el);
      });
    });
  };

  if (!native)
    document.addEventListener(
      "scroll",
      (e) => {
        const el = e.target;
        if (el instanceof HTMLElement && el.hasAttribute("data-thumb")) move(el);
      },
      { capture: true, passive: true },
    );

  window.addEventListener("resize", sync);
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  sync();
}
