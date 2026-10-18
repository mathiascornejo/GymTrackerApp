import { averageOver } from "../ranking/stats";
import s from "./Averages.module.css";

const PERIODS = [
  { label: "Past 7 days", days: 7 },
  { label: "Past 30 days", days: 30 },
  { label: "Past 365 days", days: 365 },
] as const;

/** Mean of the entries in the last week, month (30 days) and year, ending today. A period with no entries shows a dash. */
export function Averages({ points, format }: { points: { t: number; v: number }[]; format: (v: number) => string }) {
  return (
    <dl className={s.row} aria-label="Averages">
      {PERIODS.map(({ label, days }) => {
        const v = averageOver(points, days);
        return (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{v === null ? "–" : format(v)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
