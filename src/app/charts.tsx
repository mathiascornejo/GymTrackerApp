import s from "./Dashboard.module.css";

export type Point = { t: number; v: number };

const dateLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** A plain line chart drawn straight on the page: no card, no gridlines beyond the baseline. */
export function LineChart({ points, unit, label }: { points: Point[]; unit: string; label: string }) {
  if (points.length === 0) return null;
  const W = 600;
  const H = 180;
  const pad = { l: 8, r: 8, t: 28, b: 24 };
  const ts = points.map((p) => p.t);
  const vs = points.map((p) => p.v);
  const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || Math.max(1, hi * 0.1);
  const x = (t: number) => pad.l + (t1 === t0 ? (W - pad.l - pad.r) / 2 : ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - (lo - span * 0.1)) / (span * 1.2)) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const latest = points[points.length - 1];
  return (
    <figure className={s.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${points.length} points, latest ${Math.round(latest.v * 10) / 10} ${unit} on ${dateLabel(latest.t)}`}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--hairline)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.v)} r={i === points.length - 1 ? 4.5 : 2.5} fill="var(--accent)" />
        ))}
        <text x={pad.l} y={H - 6} className={s.axis}>{dateLabel(t0)}</text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" className={s.axis}>{dateLabel(t1)}</text>
        <text x={pad.l} y={14} className={s.axis}>{Math.round((hi) * 10) / 10} {unit}</text>
      </svg>
    </figure>
  );
}

export function Ring({ value, total, label }: { value: number; total: number; label: string }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const frac = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={label}>
      <circle cx="56" cy="56" r={R} fill="none" stroke="var(--hairline)" strokeWidth="9" />
      <circle
        cx="56" cy="56" r={R} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 56 56)"
      />
      <text x="56" y="62" textAnchor="middle" className={s.ringText}>{value}</text>
    </svg>
  );
}

/** Weeks across, weekdays down. Count is in the cell's title, so colour is not the only signal. */
export function FrequencyGrid({ weeks, dayNames }: { weeks: { weekStart: Date; days: number[] }[]; dayNames: string[] }) {
  const cell = 18;
  const gap = 4;
  const W = weeks.length * (cell + gap);
  const H = 7 * (cell + gap);
  const total = weeks.reduce((n, w) => n + w.days.reduce((a, b) => a + b, 0), 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.freq} role="img" aria-label={`Sessions over the last ${weeks.length} weeks: ${total}`}>
      {weeks.map((w, wi) =>
        w.days.map((n, di) => (
          <rect
            key={`${wi}-${di}`} x={wi * (cell + gap)} y={di * (cell + gap)} width={cell} height={cell} rx="5"
            fill={n === 0 ? "var(--hairline)" : "var(--accent)"} fillOpacity={n === 0 ? 1 : n === 1 ? 0.6 : 1}
          >
            <title>{`${dayNames[di]} ${w.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${n} ${n === 1 ? "session" : "sessions"}`}</title>
          </rect>
        )),
      )}
    </svg>
  );
}
