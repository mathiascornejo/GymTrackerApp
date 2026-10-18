import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatHeight, HEIGHT_CM, parseHeight, type Unit } from "../units";
import f from "./Form.module.css";
import h from "./HeightPicker.module.css";

const ITEM = 36; // px; matches .item in the stylesheet
const SETTLE_MS = 150;
const DEFAULT_CM = 170; // where the wheel rests while no height is set

/** The heights the wheel offers, in cm: every centimetre, or every inch for feet and inches. */
function options(unit: Unit): number[] {
  if (unit === "kg") return Array.from({ length: HEIGHT_CM.max - HEIGHT_CM.min + 1 }, (_, i) => HEIGHT_CM.min + i);
  const lo = Math.ceil(HEIGHT_CM.min / 2.54);
  const hi = Math.floor(HEIGHT_CM.max / 2.54);
  return Array.from({ length: hi - lo + 1 }, (_, i) => Math.round((lo + i) * 25.4) / 10);
}

const nearest = (opts: number[], cm: number) => opts.reduce((best, v, i) => (Math.abs(v - cm) < Math.abs(opts[best] - cm) ? i : best), 0);

/** A height row with a typed field and a snapping wheel under it. Both write the same value; the wheel saves once it stops moving. */
export function HeightPicker({ valueCm, unit, onCommit }: { valueCm: number | null; unit: Unit; onCommit: (cm: number) => void }) {
  const opts = useMemo(() => options(unit), [unit]);
  // The profile cache notifies asynchronously, so the draft keeps the control where the person put it.
  const [draft, setDraft] = useState(valueCm);
  useEffect(() => setDraft(valueCm), [valueCm]);
  const [text, setText] = useState(valueCm === null ? "" : formatHeight(valueCm, unit));
  useEffect(() => setText(draft === null ? "" : formatHeight(draft, unit)), [draft, unit]);

  const idx = nearest(opts, draft ?? DEFAULT_CM);
  const box = useRef<HTMLDivElement>(null);
  const shown = useRef(idx); // the item the wheel last reported
  const moving = useRef(false); // true from the first item change by hand until the wheel settles
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Move the wheel when the value changes from outside it (typing, keys, unit switch); never while a hand is on it.
  useLayoutEffect(() => {
    shown.current = idx;
    const el = box.current;
    if (el && !moving.current && Math.abs(el.scrollTop - idx * ITEM) > 1) el.scrollTop = idx * ITEM;
  }, [idx, opts]);

  const choose = (i: number) => {
    const next = Math.min(opts.length - 1, Math.max(0, i));
    setDraft(opts[next]);
    onCommit(opts[next]);
  };

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    const i = Math.min(opts.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)));
    if (i !== shown.current) {
      shown.current = i;
      moving.current = true;
      setDraft(opts[i]);
    }
    if (!moving.current) return;
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      moving.current = false;
      onCommit(opts[shown.current]);
    }, SETTLE_MS);
  };

  const commitText = () => {
    const cm = parseHeight(text, unit);
    if (cm === null) setText(draft === null ? "" : formatHeight(draft, unit));
    else if (cm !== draft) {
      setDraft(cm);
      onCommit(cm);
    }
  };

  return (
    <>
      <label className={f.row}>
        <span className={f.label}>Height</span>
        <input
          className={f.input}
          inputMode="text"
          placeholder="Not set"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </label>
      <div className={`${f.row} ${h.wheelRow}`}>
        <div className={h.wheel}>
          <div className={h.band} aria-hidden="true" />
          <div
            ref={box}
            className={h.box}
            role="slider"
            tabIndex={0}
            aria-label="Height wheel"
            aria-orientation="vertical"
            aria-valuemin={opts[0]}
            aria-valuemax={opts[opts.length - 1]}
            aria-valuenow={opts[idx]}
            aria-valuetext={draft === null ? "Not set" : formatHeight(draft, unit)}
            onScroll={onScroll}
            onKeyDown={(e) => {
              const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1, PageDown: 5, PageUp: -5 }[e.key];
              if (step === undefined && e.key !== "Home" && e.key !== "End") return;
              e.preventDefault();
              choose(e.key === "Home" ? 0 : e.key === "End" ? opts.length - 1 : idx + step!);
            }}
          >
            {opts.map((cm, i) => (
              <div key={cm} className={h.item} data-on={i === idx && draft !== null ? "" : undefined} aria-hidden="true" onClick={() => choose(i)}>
                {formatHeight(cm, unit)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
