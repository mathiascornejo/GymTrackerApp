import { supabase } from "./client";

// One active timer per user: starting or changing one cancels the old row first. Calls run in order.
let chain: Promise<unknown> = Promise.resolve();
const serial = <T,>(job: () => Promise<T>): Promise<T> => {
  const p = chain.then(job, job);
  chain = p.catch(() => undefined);
  return p;
};

export const SKEW_KEY = "tempered.clockSkew";

const active = () => supabase.from("rest_timers").update({ cancelled_at: new Date().toISOString() }).is("sent_at", null).is("cancelled_at", null);

/** Arms the server-side alarm. Resolves false when it could not be stored; the on-screen timer is unaffected. */
export function armAlarm(fireAtMs: number, label: string): Promise<boolean> {
  return serial(async () => {
    try {
      // Send the remaining time, not fireAtMs: the server times it by its own clock, so a phone clock that is off does not delay the push.
      const { data, error } = await supabase.rpc("arm_rest_timer", { delay_ms: Math.max(0, Math.round(fireAtMs - Date.now())), label });
      if (error) return false;
      // Phone clock minus server clock, so Settings can report how late an alarm really was.
      try {
        localStorage.setItem(SKEW_KEY, String(fireAtMs - Date.parse(data as string)));
      } catch {
        /* diagnostics only */
      }
      return true;
    } catch {
      return false;
    }
  });
}

/** Skip, finish or foreground completion: stop the background push so it cannot double up. */
export function cancelAlarm(): Promise<void> {
  return serial(async () => {
    try {
      await active();
    } catch {
      /* offline: the timer was never armed on the server, or the push is moot */
    }
  });
}
