import { BACK, DECOR, FRONT, MATERIAL_IDS, SILHOUETTE, VIEWBOX, type Region } from "./bodyMapArt";
import { cap } from "../exercises/query";
import { TIERS } from "../ranking/standards";
import s from "./Dashboard.module.css";

const METAL: Record<string, [string, string, string]> = {
  // dark edge, base, specular band
  bronze: ["#7d4a1f", "#B87333", "#f0c9a4"],
  silver: ["#7f8590", "#AEB4BE", "#f3f5f8"],
  gold: ["#a97d1a", "#E2B13C", "#fff0b3"],
  platinum: ["#5f9aa1", "#8FC9CF", "#e9fcfe"],
};

/** Static materials. Rendered once per page; each map references them by id. */
export function MaterialDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <defs>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.5" numOctaves="2" seed="3" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0 0.04  0 0 0 0.8 -0.2" />
        </filter>
        <pattern id="mat-wood" width="200" height="380" patternUnits="userSpaceOnUse">
          <rect width="200" height="380" fill="#8A6A47" />
          <rect width="200" height="380" filter="url(#grain)" />
        </pattern>
        {Object.entries(METAL).map(([id, [dark, base, spec]]) => (
          <linearGradient key={id} id={`mat-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="380">
            <stop offset="0" stopColor={dark} />
            <stop offset="0.38" stopColor={base} />
            <stop offset="0.5" stopColor={spec} />
            <stop offset="0.62" stopColor={base} />
            <stop offset="1" stopColor={dark} />
          </linearGradient>
        ))}
        <pattern id="mat-diamond" width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill="#BDEBFF" />
          <polygon points="0,0 13,0 0,13" fill="#E8F8FF" />
          <polygon points="13,0 26,0 26,13" fill="#9FD8F5" />
          <polygon points="26,13 26,26 13,26" fill="#E8F8FF" />
          <polygon points="0,13 13,26 0,26" fill="#8ACBEF" />
          <polygon points="13,0 26,13 13,26 0,13" fill="#BDEBFF" fillOpacity="0.6" />
        </pattern>
        <radialGradient id="mat-master" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#C9A0F5" />
          <stop offset="0.55" stopColor="#9B5DE5" />
          <stop offset="1" stopColor="#6A33B5" />
        </radialGradient>
        <linearGradient id="mat-olympian" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E23B52" />
          <stop offset="1" stopColor="#A31527" />
        </linearGradient>
        <linearGradient id="sheen" gradientUnits="userSpaceOnUse" x1="-70" y1="0" x2="-10" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function Shape({ region, className, ...rest }: { region: Region } & Omit<React.SVGProps<SVGPathElement>, "r">) {
  return (
    <>
      <path d={region.d} className={className} {...rest} />
      {region.mirror && <path d={region.d} className={className} transform="translate(200 0) scale(-1 1)" {...rest} />}
    </>
  );
}

export function BodyMap({
  view, tiers, sheen, sheenSeconds = 1.4, onSelect,
}: {
  view: "front" | "back";
  /** muscle -> tier index; muscles with no data are absent and drawn neutral. */
  tiers: Map<string, number>;
  /** Muscles playing the rank-up sheen. */
  sheen: Set<string>;
  sheenSeconds?: number;
  onSelect: (muscle: string) => void;
}) {
  const regions = view === "front" ? FRONT : BACK;
  return (
    <svg viewBox={VIEWBOX} className={s.map} role="group" aria-label={`Body map, ${view}`}>
      <path d={SILHOUETTE[view]} className={s.silhouette} />
      <path d={DECOR[view]} className={s.decor} />
      {regions.map((r) => {
        const t = tiers.get(r.muscle);
        const has = t !== undefined;
        const id = has ? MATERIAL_IDS[t] : null;
        const label = `${cap(r.muscle)}, ${has ? TIERS[t] : "no data"}. Show details`;
        return (
          <g
            key={r.muscle}
            role="button"
            tabIndex={0}
            aria-label={label}
            className={s.region}
            onClick={() => onSelect(r.muscle)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(r.muscle))}
          >
            {/* Wide transparent stroke: a generous touch target around thin regions. */}
            <Shape region={r} className={s.hit} />
            <Shape
              region={r}
              className={has ? s.filled : s.neutral}
              fill={id ? `url(#mat-${id})` : undefined}
              stroke={id === "olympian" ? "#F2C96B" : undefined}
              strokeWidth={id === "olympian" ? 2 : 1.5}
            />
            {sheen.has(r.muscle) && (
              <Shape region={r} fill={`url(#sheen-run-${view})`} className={s.sheenShape} />
            )}
          </g>
        );
      })}
      {sheen.size > 0 && (
        <defs>
          <linearGradient id={`sheen-run-${view}`} href="#sheen" gradientUnits="userSpaceOnUse">
            {!reduced() && (
              <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="300 0" dur={`${sheenSeconds}s`} fill="freeze" repeatCount="1" />
            )}
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}

/** Small front and back figures with an exercise's muscles highlighted. Decorative: the muscles are listed as chips beside it. */
export function MuscleMap({ primary, secondary }: { primary: string[]; secondary: string[] }) {
  const p = new Set(primary);
  const sec = new Set(secondary.filter((m) => !p.has(m)));
  const names = [...primary.map((m) => `${cap(m)} (primary)`), ...[...sec].map((m) => cap(m))];
  const figure = (view: "front" | "back", regions: Region[], label: string) => (
    <svg viewBox={VIEWBOX} className={s.miniMap} aria-hidden="true">
      <title>{label}</title>
      <path d={SILHOUETTE[view]} className={s.silhouette} />
      <path d={DECOR[view]} className={s.decor} />
      {regions.map((r) => (
        <Shape
          key={r.muscle}
          region={r}
          className={p.has(r.muscle) ? s.hlPrimary : sec.has(r.muscle) ? s.hlSecondary : s.hlOff}
        />
      ))}
    </svg>
  );
  return (
    <div className={s.miniMaps} role="img" aria-label={names.length ? `Muscles worked: ${names.join(", ")}` : "No muscles set"}>
      {figure("front", FRONT, "Front")}
      {figure("back", BACK, "Back")}
    </div>
  );
}
