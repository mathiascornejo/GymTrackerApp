/** Tier base colors in tier order. Mirrors --rank-* in tokens.css; a test keeps the two equal. */
export const TIER_COLORS = {
  wood: "#80603f",
  bronze: "#cd7a35",
  silver: "#bdbfc2",
  gold: "#c8920e",
  platinum: "#2f8f91",
  diamond: "#7fd3ff",
  master: "#8b4fd8",
  olympian: "#f2c96b",
} as const;

export type TierId = keyof typeof TIER_COLORS;

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two #rrggbb colors, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The tier name is large bold text (26 px and up), so AA needs 3:1. */
export const readableOn = (fg: string, bg: string) => contrast(fg, bg) >= 3;
