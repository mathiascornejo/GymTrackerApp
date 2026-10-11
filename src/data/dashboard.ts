import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Bodyweight, RankSet } from "../ranking/rank";
import { supabase } from "./client";
import { invalidateDerived } from "./sessions";

const PAGE = 1000; // PostgREST returns at most 1000 rows per request

async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: Error | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export type DashSession = { id: string; started_at: string; ended_at: string | null };
export type BodyweightRow = Bodyweight & { id: string };

/** Everything the dashboard derives from: working sets, finished sessions, bodyweight. */
export function useDashboardData() {
  return useQuery({
    queryKey: ["dash"],
    queryFn: async () => {
      const [sets, sessions, bodyweights] = await Promise.all([
        all<RankSet & { session_id: string }>((a, b) =>
          supabase
            .from("session_sets")
            .select("id,session_id,exercise_ref,weight_kg,reps,is_warmup,completed_at,confirmed")
            .is("deleted_at", null)
            .eq("is_warmup", false)
            .order("completed_at")
            .range(a, b),
        ),
        all<DashSession>((a, b) =>
          supabase.from("sessions").select("id,started_at,ended_at").is("deleted_at", null).not("ended_at", "is", null).order("started_at").range(a, b),
        ),
        all<BodyweightRow>((a, b) =>
          supabase.from("bodyweight_entries").select("id,measured_on,weight_kg").is("deleted_at", null).order("measured_on").range(a, b),
        ),
      ]);
      // Sets of a discarded session are soft-deleted with it, but guard against any stragglers.
      const live = new Set(sessions.map((s) => s.id));
      return { sets: sets.filter((s) => live.has(s.session_id)), sessions, bodyweights };
    },
  });
}

export function useDashboardActions() {
  const qc = useQueryClient();
  const done = () => {
    invalidateDerived();
    void qc.invalidateQueries({ queryKey: ["dash"] });
  };
  const run = (fn: (arg: never) => PromiseLike<{ error: Error | null }>) => async (arg: never) => {
    const { error } = await fn(arg);
    if (error) throw error;
  };
  return {
    addBodyweight: useMutation({
      mutationFn: run(({ measured_on, weight_kg }: { measured_on: string; weight_kg: number }) =>
        supabase.from("bodyweight_entries").insert({ measured_on, weight_kg }),
      ),
      onSuccess: done,
    }),
    confirmSet: useMutation({
      mutationFn: run((id: string) => supabase.from("session_sets").update({ confirmed: true }).eq("id", id)),
      onSuccess: done,
    }),
    deleteSet: useMutation({
      mutationFn: run((id: string) => supabase.from("session_sets").update({ deleted_at: new Date().toISOString() }).eq("id", id)),
      onSuccess: done,
    }),
  };
}
