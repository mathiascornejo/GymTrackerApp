import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "./client";

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
    Boolean(check(await supabase.auth.signUp({ email, password })).data.session),
  sendCode: async (email: string) => {
    check(await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }));
  },
  verifyCode: async (email: string, token: string) => {
    check(await supabase.auth.verifyOtp({ email, token, type: "email" }));
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
