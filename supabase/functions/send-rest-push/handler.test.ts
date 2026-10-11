import { describe, expect, it } from "vitest";
import { run, safeEqual, STALE_MS, type Deps, type Subscription, type Timer } from "./handler";

const NOW = Date.parse("2026-10-12T10:00:00Z");

function harness(opts: { timers?: Timer[]; claimed?: Record<string, Timer | null>; subs?: Record<string, Subscription[]>; sendResult?: (s: Subscription) => { ok: boolean; status?: number } }) {
  const log = { slept: [] as number[], sent: [] as { endpoint: string; payload: string; ttl: number; urgency: string }[], removed: [] as string[], claimedIds: [] as string[], subsFor: [] as string[] };
  let t = NOW;
  const deps: Deps = {
    now: () => t,
    sleep: async (ms) => {
      log.slept.push(ms);
      t += ms;
    },
    upcoming: async () => opts.timers ?? [],
    claim: async (id) => {
      log.claimedIds.push(id);
      return opts.claimed && id in opts.claimed ? opts.claimed[id] : (opts.timers ?? []).find((x) => x.id === id) ?? null;
    },
    subscriptions: async (userId) => {
      log.subsFor.push(userId);
      return opts.subs?.[userId] ?? [];
    },
    send: async (sub, payload, o) => {
      log.sent.push({ endpoint: sub.endpoint, payload, ttl: o.ttl, urgency: o.urgency });
      return (opts.sendResult?.(sub) ?? { ok: true }) as never;
    },
    removeSubscription: async (id) => void log.removed.push(id),
  };
  return { deps, log };
}

const timer = (id: string, offsetMs: number, user = "u1"): Timer => ({ id, user_id: user, fire_at: new Date(NOW + offsetMs).toISOString() });
const sub = (id: string): Subscription => ({ id, endpoint: `https://push.example/${id}`, p256dh: "k", auth: "a" });

describe("send-rest-push run", () => {
  it("waits until the fire time, then sends a minimal, short-lived, high-urgency push", async () => {
    const h = harness({ timers: [timer("t1", 4000)], subs: { u1: [sub("s1")] } });
    const r = await run(h.deps);
    expect(h.log.slept).toEqual([4000]);
    expect(r).toMatchObject({ seen: 1, sent: 1 });
    expect(h.log.sent[0]).toMatchObject({ ttl: 60, urgency: "high" });
    const payload = JSON.parse(h.log.sent[0].payload);
    expect(Object.keys(payload).sort()).toEqual(["body", "fireAt", "tag", "title"]);
    expect(payload.tag).toBe("t1");
  });

  it("sends nothing when the timer was cancelled during the wait", async () => {
    const h = harness({ timers: [timer("t1", 3000)], claimed: { t1: null }, subs: { u1: [sub("s1")] } });
    const r = await run(h.deps);
    expect(r).toMatchObject({ cancelled: 1, sent: 0 });
    expect(h.log.sent).toHaveLength(0);
    expect(h.log.subsFor).toHaveLength(0);
  });

  it("only looks up the timer owner's subscriptions", async () => {
    const h = harness({ timers: [timer("a", 0, "alice"), timer("b", 0, "bob")], subs: { alice: [sub("sa")], bob: [sub("sb")] } });
    await run(h.deps);
    expect(h.log.sent.map((s) => s.endpoint).sort()).toEqual(["https://push.example/sa", "https://push.example/sb"]);
    expect([...h.log.subsFor].sort()).toEqual(["alice", "bob"]);
  });

  it("removes subscriptions the push service reports gone, and counts other failures", async () => {
    const h = harness({
      timers: [timer("t1", 0)],
      subs: { u1: [sub("gone"), sub("flaky"), sub("ok")] },
      sendResult: (s) => (s.id === "gone" ? { ok: false, status: 410 } : s.id === "flaky" ? { ok: false, status: 503 } : { ok: true }),
    });
    const r = await run(h.deps);
    expect(r).toMatchObject({ sent: 1, removed: 1, failed: 1 });
    expect(h.log.removed).toEqual(["gone"]);
  });

  it("does not push for a timer long past due", async () => {
    const h = harness({ timers: [timer("old", -(STALE_MS + 1000))], subs: { u1: [sub("s1")] } });
    const r = await run(h.deps);
    expect(r.sent).toBe(0);
    expect(h.log.sent).toHaveLength(0);
  });

  it("does nothing without due timers", async () => {
    const h = harness({});
    expect(await run(h.deps)).toEqual({ seen: 0, sent: 0, cancelled: 0, failed: 0, removed: 0 });
  });
});

describe("safeEqual", () => {
  it("compares secrets", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});
