// Touch screens (iOS above all) ignore scrollbar styling, so draw our own thin accent bar beside each scroll area.
// Opt in with a data-thumb attribute (the box needs some right padding for the bar); the page itself always gets one,
// but the page bar only shows while the page is scrolling. Native bars are hidden for touch in global.css.
// Thumbs are plain positioned divs outside React's tree and never take pointer events, so scrolling is untouched.

const TOUCH = "(hover: none) and (pointer: coarse)";
const WIDTH = 4;
const EDGE = 5;
const INSET = 4;
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

  // The part of an element that is actually on screen: its box cut down by every clipping ancestor and the viewport.
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    let { top, bottom, left, right } = r;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      const b = p.getBoundingClientRect();
      top = Math.max(top, b.top);
      bottom = Math.min(bottom, b.bottom);
      left = Math.max(left, b.left);
      right = Math.min(right, b.right);
    }
    return { box: r, top: Math.max(top, 0), bottom: Math.min(bottom, window.innerHeight), right: Math.min(right, window.innerWidth), left };
  };

  // A box that is still fading in (the popup) must not have a fully visible bar: multiply every ancestor's opacity.
  const opacityOf = (el: Element) => {
    let o = 1;
    for (let p: Element | null = el; p; p = p.parentElement) o *= Number(getComputedStyle(p).opacity);
    return o;
  };

  // The bar is drawn inside the scroll box and clamped to its visible part, so it can never sit outside its container.
  const place = ({ scroller, thumb }: Area) => {
    const page = scroller === document.documentElement;
    const viewH = page ? window.innerHeight : scroller.clientHeight;
    const total = scroller.scrollHeight;
    if (total <= viewH + 1) {
      thumb.style.display = "none";
      return;
    }
    const v = page ? { box: { top: 0, right: window.innerWidth }, top: 0, bottom: window.innerHeight, right: window.innerWidth, left: 0 } : visible(scroller);
    const inset = page ? 0 : INSET;
    const track = viewH - 2 * inset;
    const size = Math.max(MIN, (viewH / total) * track);
    const top = v.box.top + inset + (scroller.scrollTop / (total - viewH)) * (track - size);
    const from = Math.max(top, v.top + inset);
    const to = Math.min(top + size, v.bottom - inset);
    const x = Math.min(v.box.right, v.right) - WIDTH - (page ? 2 : EDGE);
    if (to - from < 4 || x < v.left) {
      thumb.style.display = "none";
      return;
    }
    thumb.style.display = "block";
    if (!page) thumb.style.opacity = String(opacityOf(scroller));
    thumb.style.height = `${to - from}px`;
    thumb.style.top = `${from}px`;
    thumb.style.left = `${x}px`;
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
  let seen = "";
  const tick = () => {
    queued = false;
    sync();
    // Keep following while any scroll box is still moving (the popup grows with a transform), then stop.
    const now = [...areas.keys()].map((el) => { const r = el.getBoundingClientRect(); return `${r.top}${r.height}${r.left}${r.width}`; }).join();
    if (now !== seen) {
      seen = now;
      frames = Math.max(frames, 10);
    }
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
