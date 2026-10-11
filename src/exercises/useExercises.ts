import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCustomExercises } from "../data/customExercises";
import { loadDataset } from "./dataset";
import type { Exercise } from "./types";

/** Dataset plus the user's custom exercises, with a ref lookup. */
export function useExercises() {
  const dataset = useQuery({ queryKey: ["dataset"], queryFn: loadDataset, staleTime: Infinity });
  const custom = useCustomExercises();
  const all = useMemo<Exercise[]>(() => [...(dataset.data ?? []), ...(custom.data ?? [])], [dataset.data, custom.data]);
  const byRef = useMemo(() => new Map(all.map((e) => [e.ref, e])), [all]);
  return { all, byRef, loading: dataset.isPending };
}
