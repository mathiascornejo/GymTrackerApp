import { useEffect, useRef, useState } from "react";
import { armAlarm, cancelAlarm } from "../data/restTimers";
import { adjustTimer, mmss, remainingS, startTimer, type RestTimer } from "../session/timer";
import type { PushState } from "../data/push";
import s from "./Session.module.css";

const KEY = "tempered.rest";
const load = (): RestTimer => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.endsAt === "number" ? v : null;
  } catch {
    return null;
  }
};

// Web Audio must be created or resumed inside a user gesture; starting the timer is that gesture.
let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    /* no audio support: the visual and vibration alerts still work */
  }
}

function beep() {
  try {
    if (!audio) return;
    const t0 = audio.currentTime;
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t0 + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.18);
      osc.connect(gain).connect(audio!.destination);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.2);
    });
  } catch {
    /* ignore */
  }
}

type Armed = "idle" | "on" | "failed";

export function useRestTimer(push: PushState | null) {
  const [timer, setTimer] = useState<RestTimer>(load);
  const [armed, setArmed] = useState<Armed>("idle");
  const [now, setNow] = useState(() => Date.now());
  const alarmed = useRef<number | null>(null);

  useEffect(() => {
    try {
      if (timer) localStorage.setItem(KEY, JSON.stringify(timer));
      else localStorage.removeItem(KEY);
    } catch {
      /* the timer still runs for this page load */
    }
  }, [timer]);

  useEffect(() => {
    if (!timer) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timer]);

  const remaining = remainingS(timer, now);
  const finished = timer !== null && remaining === 0;

  const arm = (endsAt: number) => {
    if (push !== "on") return;
    void armAlarm(endsAt, "Rest").then((ok) => setArmed(ok ? "on" : "failed"));
  };
  const disarm = () => {
    setArmed("idle");
    if (push === "on") void cancelAlarm();
  };

  useEffect(() => {
    if (!timer || remaining > 0 || alarmed.current === timer.endsAt) return;
    alarmed.current = timer.endsAt;
    // A hidden page can still tick (Android keeps timers running): the push is then the only alert that reaches the user, so keep it.
    if (document.visibilityState !== "visible") return;
    beep();
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    disarm(); // the on-screen alarm fired, so stop the background push from doubling it
  }, [timer, remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  const alarm =
    push === "on"
      ? armed === "failed"
        ? "Background alarm off. Could not reach the server."
        : "Background alarm on"
      : push === null
        ? ""
        : "Background alarm off. Turn on notifications in Settings.";

  return {
    timer,
    remaining,
    finished,
    alarm,
    start(seconds: number) {
      unlockAudio();
      const t = Date.now();
      setNow(t);
      const next = startTimer(seconds, t);
      setTimer(next);
      if (next) arm(next.endsAt);
    },
    adjust(deltaS: number) {
      const t = Date.now();
      setNow(t);
      const next = timer ? adjustTimer(timer, deltaS, t) : null;
      setTimer(next);
      if (next) arm(next.endsAt);
    },
    clear() {
      setTimer(null);
      disarm();
    },
  };
}

export type Rest = ReturnType<typeof useRestTimer>;

const R = 22;
const C = 2 * Math.PI * R;

/** Sticky at the bottom of the log: a slim pill when idle, a full bar while running. The pill is labelled with the rest the current block calls for. */
export function RestBar({ rest, suggestedS }: { rest: Rest; suggestedS: number }) {
  const running = rest.timer !== null && !rest.finished;
  const fraction = rest.timer ? rest.remaining / rest.timer.totalS : 0;
  return (
    <div className={`${s.restBar} ${rest.timer ? "" : s.restIdle} ${rest.finished ? s.restDone : ""}`} role="region" aria-label="Rest timer">
      {/* The alarm state only matters once a rest is running, so the idle pill stays slim. */}
      {rest.alarm && rest.timer && <span className={s.alarmState}>{rest.alarm}</span>}
      {!rest.timer && (
        <button type="button" className={s.restStart} onClick={() => rest.start(suggestedS)}>
          Rest {mmss(suggestedS)}
        </button>
      )}
      {rest.timer && (
        <>
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r={R} fill="none" stroke="var(--hairline)" strokeWidth="4" />
            <circle
              cx="26" cy="26" r={R} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - fraction)} transform="rotate(-90 26 26)"
            />
          </svg>
          <div className={s.restText} role="timer" aria-live={rest.finished ? "assertive" : "off"}>
            <span className={s.restTime}>{rest.finished ? "Rest done" : mmss(rest.remaining)}</span>
          </div>
          {running && (
            <>
              <button type="button" className={s.restBtn} onClick={() => rest.adjust(-15)} aria-label="Subtract 15 seconds">−15</button>
              <button type="button" className={s.restBtn} onClick={() => rest.adjust(15)} aria-label="Add 15 seconds">+15</button>
            </>
          )}
          <button type="button" className={s.restBtn} onClick={rest.clear}>{rest.finished ? "Dismiss" : "Skip"}</button>
        </>
      )}
    </div>
  );
}
