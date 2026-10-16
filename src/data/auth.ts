import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "./client";

// Email links land on the app root, so they work the same on GitHub Pages and the local stack.
const appUrl = () => `${location.origin}${import.meta.env.BASE_URL}`;

const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};

export const auth = {
  signIn: async (email: string, password: string) => {
    check(await supabase.auth.signInWithPassword({ email, password }));
  },
  /** Returns true when a session started; false when the project requires email confirmation first. */
  signUp: async (email: string, password: string) =>
    // Land back on this app (including the /GymTrackerApp/ path) rather than whatever the project's Site URL says.
    Boolean(
      check(await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } }))
        .data.session,
    ),
  sendCode: async (email: string) => {
    check(await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }));
  },
  verifyCode: async (email: string, token: string) => {
    check(await supabase.auth.verifyOtp({ email, token, type: "email" }));
  },
  /** Emails a link that signs the user in and opens the set-new-password screen. */
  resetPassword: async (email: string) => {
    check(await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() }));
  },
  updatePassword: async (password: string) => {
    check(await supabase.auth.updateUser({ password }));
  },
  signOut: async () => {
    check(await supabase.auth.signOut());
  },
};

/** undefined while the stored session loads, null when signed out. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

// Read the landing hash at load, before the client clears it: a recovery link arrives as #access_token=…&type=recovery,
// and a dead link as #error_description=…. Hash routing would otherwise treat both as an unknown route.
const landing = new URLSearchParams(typeof location === "undefined" ? "" : location.hash.slice(1));
let recovering = landing.get("type") === "recovery";
/** Why an email link failed (expired, already used), shown once on the sign-in screen. */
export const linkError = landing.get("error_description") ?? "";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    recovering = true;
    emit();
  }
});

/** True after a password-recovery link signed the user in, until they set a new password or skip. */
export function useRecovery() {
  const pending = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => recovering,
  );
  const done = () => {
    recovering = false;
    emit();
  };
  return [pending, done] as const;
}
