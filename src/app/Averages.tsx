import { averageOver } from "../ranking/stats";
import s from "./Averages.module.css";

const PERIODS = [
  { label: "Past 7 days", days: 7 },
  { label: "Past 30 days", days: 30 },
  { label: "Past 365 days", days: 365 },
] as const;

/** Mean of the entries in the last week, month (30 days) and year, ending today. A period with no entries shows a dash. */
export function Averages({ points, format, label = "Averages" }: { points: { t: number; v: number }[]; format: (v: number) => string; label?: string }) {
  return (
    <dl className={s.row} aria-label={label}>
      {PERIODS.map(({ label: period, days }) => {
        const v = averageOver(points, days);
        return (
          <div key={period}>
            <dt>{period}</dt>
            <dd>{v === null ? "–" : format(v)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
