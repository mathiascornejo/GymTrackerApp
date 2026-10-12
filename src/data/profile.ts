import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toKg, type Unit } from "../units";
import { supabase } from "./client";

export type Profile = {
  id: string;
  display_name: string;
  weight_unit: Unit;
  theme: "system" | "light" | "dark";
  standards_table: "male" | "female" | null;
  week_starts_on: number;
  default_rest_s: number;
  wake_lock_enabled: boolean;
  auto_start_rest: boolean;
  /** exercise_ref -> progression step in kg. */
  increments: Record<string, number>;
  /** exercise_ref -> seven bodyweight multiples (Bronze..Olympian) replacing the file's standards. */
  standards_overrides: Record<string, number[]>;
};

export type ProfilePatch = Partial<Omit<Profile, "id">>;

const KEY = ["profile"];

async function get(): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").single();
  if (error) throw error;
  return data;
}

async function update(patch: ProfilePatch): Promise<Profile> {
  // PostgREST refuses an UPDATE with no filter; RLS already limits this to the caller's own row.
  const { data, error } = await supabase.from("profiles").update(patch).not("id", "is", null).select().single();
  if (error) throw error;
  return data;
}

/** Bodyweight goes first: the profile flag that ends onboarding is written last, so a failure retries cleanly. */
async function completeRankingSetup(input: { unit: Unit; standards: "male" | "female"; weight: number }) {
  const { error } = await supabase
    .from("bodyweight_entries")
    .insert({ measured_on: new Date().toLocaleDateString("en-CA"), weight_kg: toKg(input.weight, input.unit) });
  if (error) throw error;
  return update({ weight_unit: input.unit, standards_table: input.standards });
}

export const useProfile = () => useQuery({ queryKey: KEY, queryFn: get });

export function useUpdateProfile() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationKey: KEY,
    mutationFn: ({ patch }: { patch: ProfilePatch; previous?: Profile }) => update(patch),
    // No refetch on success: the patch already is the new state, and a refetch racing a newer patch would undo it.
    onError: (_e, { previous }) => previous && qc.setQueryData(KEY, previous),
  });
  return {
    error: m.error,
    // The cache is patched synchronously so controlled inputs never flicker back while the save is in flight.
    mutate: (patch: ProfilePatch) => {
      // An in-flight refetch would overwrite the patch with stale data; revert:false stops the cancel from rolling the cache back too.
      void qc.cancelQueries({ queryKey: KEY }, { revert: false });
      const previous = qc.getQueryData<Profile>(KEY);
      if (previous) qc.setQueryData(KEY, { ...previous, ...patch });
      m.mutate({ patch, previous });
    },
  };
}

export function useCompleteRankingSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: completeRankingSetup,
    onSuccess: (p) => qc.setQueryData(KEY, p),
  });
}
