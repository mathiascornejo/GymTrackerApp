import { disablePush } from "./push";
import { supabase } from "./client";
import { fetchAllPages } from "./dashboard";
import type { ExportSession, ExportSet } from "../export";

export type FullExport = {
  sessions: (ExportSession & { bodyweight_kg: number | null })[];
  sets: ExportSet[];
  bodyweight: { measured_on: string; weight_kg: number }[];
};

/** Everything the user has logged, un-paged. Includes unfinished sessions and warm-ups. */
export async function fetchFullExport(): Promise<FullExport> {
  const [sessions, sets, bodyweight] = await Promise.all([
    fetchAllPages<FullExport["sessions"][number]>((a, b) =>
      supabase.from("sessions").select("id,started_at,ended_at,notes,routine_id,bodyweight_kg").is("deleted_at", null).order("started_at").range(a, b),
    ),
    fetchAllPages<ExportSet>((a, b) =>
      supabase
        .from("session_sets")
        .select("session_id,exercise_ref,round_index,set_number,weight_kg,reps,rpe,is_warmup,completed_at")
        .is("deleted_at", null)
        .order("completed_at")
        .range(a, b),
    ),
    fetchAllPages<FullExport["bodyweight"][number]>((a, b) =>
      supabase.from("bodyweight_entries").select("measured_on,weight_kg").is("deleted_at", null).order("measured_on").range(a, b),
    ),
  ]);
  return { sessions, sets, bodyweight };
}

/** Removes the account and every row it owns, then clears this device. The server checks the typed email again. */
export async function deleteAccount(email: string) {
  try {
    await disablePush(); // unregister this device's push subscription before its row disappears
  } catch {
    /* the rows are deleted with the account either way */
  }
  const { error, data } = await supabase.functions.invoke("delete-account", { body: { confirm: email } });
  if (error) {
    let message = error.message;
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
  if (!data?.ok) throw new Error("The account could not be deleted. Nothing was changed.");
  for (const k of Object.keys(localStorage)) if (k.startsWith("tempered.")) localStorage.removeItem(k);
  await supabase.auth.signOut({ scope: "local" });
}
