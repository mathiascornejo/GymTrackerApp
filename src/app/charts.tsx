import { Fragment } from "react";
import s from "./Dashboard.module.css";

export type Point = { t: number; v: number };

const dateLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** A plain line chart drawn straight on the page: no card, no gridlines beyond the baseline. */
export function LineChart({ points, unit, label, average }: { points: Point[]; unit: string; label: string; average?: Point[] }) {
  if (points.length === 0) return null;
  const W = 600;
  const H = 180;
  const pad = { l: 8, r: 8, t: 12, b: 12 };
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
  const fmt = (v: number) => `${Math.round(v * 10) / 10} ${unit}`;
  return (
    <figure className={s.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${points.length} points, latest ${Math.round(latest.v * 10) / 10} ${unit} on ${dateLabel(latest.t)}`}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--hairline)" />
        {average && (
          <path
            d={average.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ")}
            fill="none" stroke="var(--ink-muted)" strokeWidth="2" strokeDasharray="6 5" strokeLinejoin="round"
          />
        )}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.t)} cy={y(p.v)} r={i === points.length - 1 ? 4.5 : 2.5} fill="var(--accent)" />
        ))}
      </svg>
      {/* Labels are HTML so they stay 12 px however far the SVG scales down. */}
      {points.length === 1 ? (
        <figcaption className={s.axis} style={{ textAlign: "center" }} aria-hidden="true">{fmt(latest.v)} · {dateLabel(t0)}</figcaption>
      ) : (
        <figcaption className={s.axisRow} aria-hidden="true">
          <span>{dateLabel(t0)}</span>
          <span>{average ? `7-day average ${fmt(average[average.length - 1].v)}` : `High ${fmt(hi)}`}</span>
          <span>{dateLabel(t1)}</span>
        </figcaption>
      )}
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

/** Weeks across, weekdays down. HTML, not SVG, so labels stay 12 px. Count is in each cell's title, so colour is not the only signal. */
export function FrequencyGrid({ weeks, dayNames }: { weeks: { weekStart: Date; days: number[] }[]; dayNames: string[] }) {
  const total = weeks.reduce((n, w) => n + w.days.reduce((a, b) => a + b, 0), 0);
  const day = (w: Date, i: number) => new Date(w.getFullYear(), w.getMonth(), w.getDate() + i);
  return (
    <div className={s.freq} role="img" aria-label={`${total} ${total === 1 ? "session" : "sessions"} in the last ${weeks.length} weeks`}>
      <span />
      {weeks.map((w, wi) => {
        // Label the column holding the 1st of a month.
        const first = Array.from({ length: 7 }, (_, i) => day(w.weekStart, i)).find((d) => d.getDate() === 1);
        return <span key={wi} className={s.freqMonth}>{first?.toLocaleDateString(undefined, { month: "short" })}</span>;
      })}
      {dayNames.map((name, di) => (
        <Fragment key={di}>
          <span className={s.freqDay}>{di % 2 === 0 ? name.charAt(0) : ""}</span>
          {weeks.map((w, wi) => {
            const n = w.days[di];
            return (
              <span
                key={wi} className={s.freqCell} style={n ? { background: "var(--accent)", opacity: n === 1 ? 0.6 : 1 } : undefined}
                title={`${name} ${day(w.weekStart, di).toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${n} ${n === 1 ? "session" : "sessions"}`}
              />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
