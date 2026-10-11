export type RestTimer = { endsAt: number; totalS: number } | null;

/** The countdown is an absolute timestamp, never a counter, so a throttled or suspended tab cannot drift. */
export const remainingS = (t: RestTimer, now: number) => (t ? Math.max(0, Math.ceil((t.endsAt - now) / 1000)) : 0);

export const startTimer = (seconds: number, now: number): RestTimer => ({ endsAt: now + seconds * 1000, totalS: seconds });

/** +/- seconds on a running timer; never below now, and the ring total follows so the fraction stays sensible. */
export function adjustTimer(t: NonNullable<RestTimer>, deltaS: number, now: number): RestTimer {
  const endsAt = Math.max(now, t.endsAt + deltaS * 1000);
  return { endsAt, totalS: Math.max(1, t.totalS + (endsAt - t.endsAt) / 1000) };
}

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
