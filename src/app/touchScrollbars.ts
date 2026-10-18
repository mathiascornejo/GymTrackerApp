// Touch screens (iOS above all) ignore scrollbar styling, so draw our own thin accent bar beside each scroll area.
// Opt in with a data-thumb attribute (data-thumb="inside" draws it inside the box's right padding); the page itself always gets one,
// but the page bar only shows while the page is scrolling. Native bars are hidden for touch in global.css.
// Thumbs are plain positioned divs outside React's tree and never take pointer events, so scrolling is untouched.

const TOUCH = "(hover: none) and (pointer: coarse)";
const WIDTH = 4;
const GAP = 3;
const MIN = 28;

type Area = { scroller: Element; thumb: HTMLDivElement };

export function installTouchScrollbars() {
  if (!window.matchMedia(TOUCH).matches) return;

  const areas = new Map<Element, Area>();
  let frames = 0;
  let queued = false;

  const make = (host: Element, page: boolean) => {
    const thumb = document.createElement("div");
    thumb.setAttribute("aria-hidden", "true");
    thumb.style.cssText = `position:fixed;z-index:2147483647;width:${WIDTH}px;border-radius:${WIDTH}px;background:var(--accent);pointer-events:none;display:none`;
    if (page) thumb.style.cssText += ";opacity:0;transition:opacity .25s";
    host.appendChild(thumb);
    return thumb;
  };

  // The popup is a top-layer dialog, so a thumb for something inside it must live inside that dialog to be seen.
  const hostFor = (el: Element) => el.closest("dialog") ?? document.body;

  const place = ({ scroller, thumb }: Area) => {
    const page = scroller === document.documentElement;
    const viewH = page ? window.innerHeight : scroller.clientHeight;
    const total = scroller.scrollHeight;
    if (total <= viewH + 1) {
      thumb.style.display = "none";
      return;
    }
    const r = page ? { top: 0, right: window.innerWidth - WIDTH - 2 * GAP } : scroller.getBoundingClientRect();
    // "inside": a bordered box, so the bar sits inside its right padding and keeps clear of the corners.
    const inside = scroller.getAttribute("data-thumb") === "inside";
    const inset = inside ? 10 : 0;
    const track = viewH - 2 * inset;
    const size = Math.max(MIN, (viewH / total) * track);
    const y = (scroller.scrollTop / (total - viewH)) * (track - size);
    thumb.style.display = "block";
    thumb.style.height = `${size}px`;
    thumb.style.top = `${r.top + inset + y}px`;
    thumb.style.left = `${inside ? r.right - WIDTH - 8 : r.right + GAP}px`;
  };

  const sync = () => {
    const wanted = new Set<Element>([document.documentElement, ...document.querySelectorAll("[data-thumb]")]);
    for (const [el, a] of areas)
      if (!wanted.has(el) || !el.isConnected || a.thumb.parentElement !== hostFor(el)) {
        a.thumb.remove();
        areas.delete(el);
      }
    for (const el of wanted) if (!areas.has(el)) areas.set(el, { scroller: el, thumb: make(el === document.documentElement ? document.body : hostFor(el), el === document.documentElement) });
    areas.forEach(place);
  };

  // A few frames of follow-up so the popup's grow animation (a transform) is tracked until it settles.
  const tick = () => {
    queued = false;
    sync();
    if (frames-- > 0) schedule();
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(tick);
  };
  const kick = () => {
    frames = 40;
    schedule();
  };

  // The page bar fades in while the page scrolls and out a moment after it stops.
  let fade = 0;
  const showPage = () => {
    const a = areas.get(document.documentElement);
    if (!a) return;
    a.thumb.style.opacity = "1";
    clearTimeout(fade);
    fade = window.setTimeout(() => (a.thumb.style.opacity = "0"), 900);
  };

  document.addEventListener(
    "scroll",
    (e) => {
      if (e.target === document) showPage();
      kick();
    },
    { capture: true, passive: true },
  );
  window.addEventListener("resize", kick);
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: true });
  kick();
}
