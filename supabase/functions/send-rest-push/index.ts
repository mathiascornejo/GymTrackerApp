// Sends due rest-timer notifications over Web Push. Called every 5 s by pg_cron (only when a timer is due).
// Secrets (set with `supabase secrets set`): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform and stay in this runtime.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { run, safeEqual, type Deps } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let vapidReady = false;
function configureVapid() {
  if (vapidReady) return;
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );
  vapidReady = true;
}

const deps: Deps = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async upcoming(horizonMs) {
    const { data, error } = await admin
      .from("rest_timers")
      .select("id,user_id,fire_at")
      .is("sent_at", null)
      .is("cancelled_at", null)
      .is("deleted_at", null)
      .lte("fire_at", new Date(Date.now() + horizonMs).toISOString());
    if (error) throw error;
    return data;
  },
  async claim(id) {
    const { data, error } = await admin
      .from("rest_timers")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", id)
      .is("sent_at", null)
      .is("cancelled_at", null)
      .select("id,user_id,fire_at");
    if (error) throw error;
    return data[0] ?? null;
  },
  async subscriptions(userId) {
    const { data, error } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) throw error;
    return data;
  },
  async send(sub, payload, opts) {
    try {
      configureVapid();
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
        TTL: opts.ttl,
        urgency: opts.urgency,
      });
      return { ok: true };
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      console.error("push failed", err.statusCode ?? "no response", err.message); // no payload or keys are logged
      return { ok: false, status: err.statusCode };
    }
  },
  async removeSubscription(id) {
    await admin.from("push_subscriptions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  },
};

Deno.serve(async (req) => {
  // The platform JWT check is off for this function (see config.toml) so the new secret-key format works;
  // the caller must present the service-role key instead.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!bearer || !safeEqual(bearer, serviceKey)) return new Response("Unauthorized", { status: 401 });
  try {
    const report = await run(deps);
    return Response.json(report);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
