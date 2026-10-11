import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Exercise } from "../exercises/types";
import { supabase } from "./client";

type Row = {
  id: string;
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string | null;
  force: string | null;
  mechanic: string | null;
  level: string | null;
  instructions: string[];
};

const KEY = ["custom_exercises"];

export const toCustomExercise = (r: Row): Exercise => ({
  ref: `custom:${r.id}`,
  name: r.name,
  primary: r.primary_muscles,
  secondary: r.secondary_muscles,
  equipment: r.equipment,
  force: r.force,
  mechanic: r.mechanic,
  level: r.level,
  category: null,
  instructions: r.instructions,
  images: [],
  custom: true,
});

/** The form edits this shape; `id` is client-generated so a retry never creates a duplicate. */
export type CustomExerciseInput = Omit<Row, "id"> & { id: string };

async function list(): Promise<Exercise[]> {
  const { data, error } = await supabase.from("custom_exercises").select("*").is("deleted_at", null).order("name");
  if (error) throw error;
  return data.map(toCustomExercise);
}

async function save(input: CustomExerciseInput) {
  const { error } = await supabase.from("custom_exercises").upsert(input, { onConflict: "id" });
  if (error) throw error;
}

async function remove(id: string) {
  const { error } = await supabase.from("custom_exercises").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export const useCustomExercises = () => useQuery({ queryKey: KEY, queryFn: list });

export function useSaveCustomExercise() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: save, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export function useDeleteCustomExercise() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: remove, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
