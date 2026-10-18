// Touch screens (iOS above all) ignore scrollbar styling, so draw our own thin accent bar.
// Scroll boxes opt in with a data-thumb attribute. Their bar is a sticky ::before inside the box (see global.css), so it moves with
// the box when the page or a popup moves and is clipped by it: it can never sit outside. This file only sets its size and offset.
// The page itself gets a fixed bar at the screen edge that shows only while the page is scrolling. Native bars are hidden for touch.

const TOUCH = "(hover: none) and (pointer: coarse)";
const WIDTH = 4;
const MIN = 28;
const INSET = 4;

export function installTouchScrollbars() {
  if (!window.matchMedia(TOUCH).matches) return;

  const page = document.createElement("div");
  page.setAttribute("aria-hidden", "true");
  page.style.cssText = `position:fixed;z-index:2147483647;width:${WIDTH}px;border-radius:${WIDTH}px;background:var(--accent);pointer-events:none;display:none;opacity:0;transition:opacity .25s`;
  document.body.appendChild(page);

  const root = document.documentElement;

  const sync = () => {
    for (const el of document.querySelectorAll<HTMLElement>("[data-thumb]")) {
      const viewH = el.clientHeight;
      const total = el.scrollHeight;
      if (total <= viewH + 1) {
        el.style.setProperty("--th-h", "0px");
        continue;
      }
      const track = viewH - 2 * INSET;
      const size = Math.max(MIN, (viewH / total) * track);
      el.style.setProperty("--th-h", `${size}px`);
      el.style.setProperty("--th-y", `${INSET + (el.scrollTop / (total - viewH)) * (track - size)}px`);
    }

    const viewH = window.innerHeight;
    if (root.scrollHeight <= viewH + 1) {
      page.style.display = "none";
      return;
    }
    const size = Math.max(MIN, (viewH / root.scrollHeight) * viewH);
    page.style.display = "block";
    page.style.height = `${size}px`;
    page.style.top = `${(root.scrollTop / (root.scrollHeight - viewH)) * (viewH - size)}px`;
    page.style.left = `${window.innerWidth - WIDTH - 2}px`;
  };

  let queued = false;
  const kick = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  };

  // The page bar fades in while the page scrolls and out a moment after it stops.
  let fade = 0;
  document.addEventListener(
    "scroll",
    (e) => {
      if (e.target === document) {
        page.style.opacity = "1";
        clearTimeout(fade);
        fade = window.setTimeout(() => (page.style.opacity = "0"), 900);
      }
      kick();
    },
    { capture: true, passive: true },
  );
  window.addEventListener("resize", kick);
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: true });
  new ResizeObserver(kick).observe(document.body);
  kick();
}
