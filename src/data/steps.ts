import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./client";
import { fetchAllPages } from "./dashboard";

export type StepRow = { id: string; logged_on: string; steps: number };

export function useSteps() {
  return useQuery({
    queryKey: ["steps"],
    queryFn: () =>
      fetchAllPages<StepRow>((a, b) => supabase.from("step_entries").select("id,logged_on,steps").is("deleted_at", null).order("logged_on").range(a, b)),
  });
}

export function useStepActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["steps"] });
  const run = async ({ error }: { error: Error | null }) => {
    if (error) throw error;
  };
  return {
    // One total per day: logging a day again replaces it, and revives it if it was deleted.
    addSteps: useMutation({
      mutationFn: async ({ logged_on, steps }: { logged_on: string; steps: number }) =>
        run(await supabase.from("step_entries").upsert({ logged_on, steps, deleted_at: null }, { onConflict: "user_id,logged_on" })),
      onSuccess: done,
    }),
    deleteSteps: useMutation({
      mutationFn: async (id: string) => run(await supabase.from("step_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id)),
      onSuccess: done,
    }),
  };
}
