import { useCallback, useEffect, useState } from "react";
import { supabase } from "./client";
import { SKEW_KEY } from "./restTimers";

export type PushState =
  | "unconfigured" // no VAPID key in this build
  | "unsupported" // no service worker or Push API
  | "needs-install" // iPhone/iPad Safari tab: push only works from the Home Screen app
  | "denied" // the browser permission is blocked
  | "ready" // can be turned on
  | "on";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const isIos = (ua: string, maxTouchPoints = 0) => /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Browsers want the VAPID public key as bytes, not base64url. */
export function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? undefined;
}

export async function readPushState(): Promise<PushState> {
  if (!VAPID_PUBLIC) return "unconfigured";
  if (isIos(navigator.userAgent, navigator.maxTouchPoints) && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await (await registration())?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "ready";
}

/** Must run from a user gesture: it asks for permission, subscribes, and stores the endpoint. */
export async function enablePush() {
  if (!VAPID_PUBLIC) throw new Error("Notifications are not configured for this build.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them in your browser or phone settings, then try again.");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("The push service returned an incomplete subscription.");
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200), deleted_at: null },
      { onConflict: "user_id,endpoint" },
    );
  if (error) throw error;
}

export async function disablePush() {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").update({ deleted_at: new Date().toISOString() }).eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export function usePushState() {
  const [state, setState] = useState<PushState | null>(null);
  const refresh = useCallback(() => {
    void readPushState().then(setState, () => setState("unsupported"));
  }, []);
  useEffect(() => {
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [refresh]);
  return [state, refresh] as const;
}

/** How late the last background alarm arrived, from the worker's own record. */
export async function lastAlarmDelayS(): Promise<number | null> {
  try {
    const res = await (await caches.open("tempered-diag")).match("last-alarm");
    if (!res) return null;
    const { fireAt, receivedAt } = (await res.json()) as { fireAt: string | null; receivedAt: number };
    const skew = Number(localStorage.getItem(SKEW_KEY)) || 0; // fireAt is server time, receivedAt is phone time
    return fireAt ? Math.round((receivedAt - skew - new Date(fireAt).getTime()) / 100) / 10 : null;
  } catch {
    return null;
  }
}
