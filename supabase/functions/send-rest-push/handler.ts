// The decision logic of send-rest-push, with every side effect injected so it can be tested without Deno, a database or a push service.

export type Timer = { id: string; user_id: string; fire_at: string };
export type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };
export type SendResult = { ok: true } | { ok: false; status?: number };

export type Deps = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Pending timers that fire within the next `horizonMs`. */
  upcoming: (horizonMs: number) => Promise<Timer[]>;
  /** Atomically marks the timer sent if it is still pending and uncancelled. Null means it was cancelled or already sent. */
  claim: (timerId: string) => Promise<Timer | null>;
  /** Only the timer owner's subscriptions. */
  subscriptions: (userId: string) => Promise<Subscription[]>;
  send: (sub: Subscription, payload: string, opts: { ttl: number; urgency: "high" }) => Promise<SendResult>;
  /** Called for endpoints the push service says are gone. */
  removeSubscription: (id: string) => Promise<void>;
};

export type Report = { seen: number; sent: number; cancelled: number; failed: number; removed: number };

export const HORIZON_MS = 6000;
export const TTL_SECONDS = 60;
/** Never send a push for a timer that is already this far past due: it would only confuse. */
export const STALE_MS = 30_000;

export async function run(deps: Deps): Promise<Report> {
  const report: Report = { seen: 0, sent: 0, cancelled: 0, failed: 0, removed: 0 };
  const timers = await deps.upcoming(HORIZON_MS);
  report.seen = timers.length;

  await Promise.all(
    timers.map(async (t) => {
      const wait = new Date(t.fire_at).getTime() - deps.now();
      if (wait > 0) await deps.sleep(wait); // cron runs every 5 s; wait out the remainder so the push lands on time
      // Claim only after the wait, so a Skip pressed in the meantime still cancels it.
      const claimed = await deps.claim(t.id);
      if (!claimed) {
        report.cancelled++;
        return;
      }
      if (deps.now() - new Date(claimed.fire_at).getTime() > STALE_MS) return;

      const subs = await deps.subscriptions(claimed.user_id);
      // No timer text or user data: the payload carries only what the notification needs to show.
      const payload = JSON.stringify({ title: "Rest Done", body: "Time for your next set.", tag: claimed.id, fireAt: claimed.fire_at });
      for (const sub of subs) {
        const res = await deps.send(sub, payload, { ttl: TTL_SECONDS, urgency: "high" });
        if (res.ok) report.sent++;
        else if (res.status === 404 || res.status === 410) {
          await deps.removeSubscription(sub.id);
          report.removed++;
        } else report.failed++;
      }
    }),
  );
  return report;
}

/** Constant-time comparison for the shared bearer secret. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
