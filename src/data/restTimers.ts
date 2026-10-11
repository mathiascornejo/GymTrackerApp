import { supabase } from "./client";

// One active timer per user: starting or changing one cancels the old row first. Calls run in order.
let chain: Promise<unknown> = Promise.resolve();
const serial = <T,>(job: () => Promise<T>): Promise<T> => {
  const p = chain.then(job, job);
  chain = p.catch(() => undefined);
  return p;
};

const active = () => supabase.from("rest_timers").update({ cancelled_at: new Date().toISOString() }).is("sent_at", null).is("cancelled_at", null);

/** Arms the server-side alarm. Resolves false when it could not be stored; the on-screen timer is unaffected. */
export function armAlarm(fireAtMs: number, label: string): Promise<boolean> {
  return serial(async () => {
    try {
      const cancel = await active();
      if (cancel.error) return false;
      const { error } = await supabase.from("rest_timers").insert({ fire_at: new Date(fireAtMs).toISOString(), label });
      return !error;
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
