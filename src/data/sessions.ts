import { useQuery } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";
import { lastSessionSets } from "../session/history";
import { supabase } from "./client";
import { queryClient } from "./queryClient";

export type SessionRow = {
  id: string;
  routine_id: string | null;
  routine_day_id: string | null;
  started_at: string;
  ended_at: string | null;
  notes: string;
  bodyweight_kg: number | null;
};

export type SetRow = {
  id: string;
  session_id: string;
  exercise_ref: string;
  block_id: string | null;
  round_index: number;
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  completed_at: string;
};

const SET_COLUMNS = "id,session_id,exercise_ref,block_id,round_index,set_number,weight_kg,reps,rpe,is_warmup,completed_at";
/** Anything derived from logged sets (history, past list, dashboard) is stale after a set changes. */
export const invalidateDerived = () => {
  for (const k of ["past", "history", "dash"]) void queryClient.invalidateQueries({ queryKey: [k] });
};
const throwIf = (r: { error: Error | null }) => {
  if (r.error) throw r.error;
};

// ---- Outbox: completed sets are written to localStorage first, then to Supabase with backoff ----
// A dropped connection or a reload mid-workout must never lose a set that was marked done.

type Op = { op: "upsert"; row: SetRow } | { op: "delete"; id: string; session_id: string };
type OutboxState = { ops: Op[]; status: "idle" | "saving" | "retry"; failure: string | null };

const OUTBOX_KEY = "tempered.outbox";

function loadOps(): Op[] {
  try {
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

let state: OutboxState = { ops: loadOps(), status: "idle", failure: null };
const listeners = new Set<() => void>();
const setState = (patch: Partial<OutboxState>) => {
  state = { ...state, ...patch };
  if (patch.ops) {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(state.ops));
    } catch {
      /* storage blocked: sets still sync while the page stays open */
    }
  }
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

async function send(op: Op) {
  if (op.op === "upsert") throwIf(await supabase.from("session_sets").upsert(op.row, { onConflict: "id" }));
  else throwIf(await supabase.from("session_sets").update({ deleted_at: new Date().toISOString() }).eq("id", op.id));
}

function patchServerCache(op: Op) {
  const sessionId = op.op === "upsert" ? op.row.session_id : op.session_id;
  queryClient.setQueryData<SetRow[]>(["sets", sessionId], (old) => {
    if (!old) return old;
    const rest = old.filter((r) => r.id !== (op.op === "upsert" ? op.row.id : op.id));
    return op.op === "upsert" ? [...rest, op.row] : rest;
  });
}

let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let inflight: Promise<void> | null = null;

async function drain() {
  clearTimeout(retryTimer);
  if (state.ops.length) setState({ status: "saving" });
  try {
    // Ops queued while this loop runs are picked up by the same pass.
    while (state.ops.length) {
      const op = state.ops[0];
      try {
        await send(op);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (!code) throw e; // no code means the request never completed: keep it and retry
        setState({ ops: state.ops.slice(1), failure: `A set could not be saved: ${(e as Error).message}` });
        continue;
      }
      patchServerCache(op);
      attempt = 0;
      setState({ ops: state.ops.slice(1) });
    }
    setState({ status: "idle" });
  } catch {
    attempt += 1;
    setState({ status: "retry" });
    retryTimer = setTimeout(() => void flushOutbox(), Math.min(30_000, 1000 * 2 ** attempt));
  }
}

/**
 * Sends queued ops in order. Network failures back off (1s, 2s, 4s ... 30s); a server rejection drops that op and reports it.
 * A call while a flush is running returns that flush, so callers (finishing a session) wait for it instead of skipping it.
 */
export function flushOutbox(): Promise<void> {
  if (!inflight) inflight = drain().finally(() => (inflight = null));
  return inflight;
}

const enqueue = (op: Op) => {
  setState({ ops: [...state.ops, op], failure: null });
  void flushOutbox();
};

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushOutbox());
  if (state.ops.length) void flushOutbox(); // sets left over from a previous page load
}

export const logSet = (row: SetRow) => enqueue({ op: "upsert", row });
export const unlogSet = (row: SetRow) => enqueue({ op: "delete", id: row.id, session_id: row.session_id });
export const useOutbox = () => useSyncExternalStore(subscribe, () => state);

/** Server rows with unsent changes applied, so a reload shows exactly what was entered. */
export function mergeSets(server: SetRow[], ops: Op[], sessionId: string): SetRow[] {
  let rows = server;
  for (const op of ops) {
    if (op.op === "upsert" && op.row.session_id === sessionId) rows = [...rows.filter((r) => r.id !== op.row.id), op.row];
    else if (op.op === "delete") rows = rows.filter((r) => r.id !== op.id);
  }
  return rows;
}

// ---- Sessions ----

export const useOpenSession = () =>
  useQuery({
    queryKey: ["session", "open"],
    queryFn: async (): Promise<SessionRow | null> => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .is("ended_at", null)
        .is("deleted_at", null)
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });

export async function startSession(input: { routineId: string | null; routineDayId: string | null }): Promise<SessionRow> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ id: crypto.randomUUID(), routine_id: input.routineId, routine_day_id: input.routineDayId })
    .select()
    .single();
  if (error) throw error;
  queryClient.setQueryData(["session", "open"], data);
  return data;
}

export async function finishSession(id: string): Promise<SessionRow> {
  await flushOutbox();
  if (state.ops.some((o) => (o.op === "upsert" ? o.row.session_id : o.session_id) === id))
    throw new Error("Some sets have not reached the server yet. Check your connection and try again.");
  const { data, error } = await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  queryClient.setQueryData(["session", "open"], null);
  invalidateDerived();
  return data;
}

/** Soft-deletes the session and its sets, and drops anything still queued for it. */
export async function discardSession(id: string) {
  setState({ ops: state.ops.filter((o) => (o.op === "upsert" ? o.row.session_id : o.session_id) !== id) });
  const now = new Date().toISOString();
  throwIf(await supabase.from("session_sets").update({ deleted_at: now }).eq("session_id", id));
  throwIf(await supabase.from("sessions").update({ deleted_at: now }).eq("id", id));
  queryClient.setQueryData(["session", "open"], null);
  invalidateDerived();
}

async function fetchSets(sessionId: string): Promise<SetRow[]> {
  const { data, error } = await supabase.from("session_sets").select(SET_COLUMNS).eq("session_id", sessionId).is("deleted_at", null);
  if (error) throw error;
  return data;
}

export function useSessionSets(sessionId: string | null) {
  const server = useQuery({ queryKey: ["sets", sessionId], queryFn: () => fetchSets(sessionId!), enabled: Boolean(sessionId) });
  const { ops } = useOutbox();
  const sets = useMemo(() => (sessionId ? mergeSets(server.data ?? [], ops, sessionId) : []), [server.data, ops, sessionId]);
  return { sets, loading: server.isPending && Boolean(sessionId), error: server.error };
}

/** Working sets for these exercises from every other session, newest first. Feeds ghost values, recommendations and PRs. */
export function useHistory(refs: string[], excludeSessionId: string | null) {
  const key = [...refs].sort().join("|");
  return useQuery({
    queryKey: ["history", key, excludeSessionId],
    enabled: refs.length > 0,
    queryFn: async (): Promise<SetRow[]> => {
      let q = supabase
        .from("session_sets")
        .select(SET_COLUMNS)
        .in("exercise_ref", refs)
        .is("deleted_at", null)
        .eq("is_warmup", false)
        .order("completed_at", { ascending: false })
        .limit(1500);
      if (excludeSessionId) q = q.neq("session_id", excludeSessionId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export const lastSets = (history: SetRow[] | undefined, ref: string) => lastSessionSets(history ?? [], ref);

/** Sessions this week that logged each bank block: the "1 of 2 this week" counter. */
export function useBankCounts(blockIds: string[], sinceIso: string, sessionId: string | null) {
  const { sets } = useSessionSets(sessionId);
  const q = useQuery({
    queryKey: ["bankCounts", [...blockIds].sort().join("|"), sinceIso],
    enabled: blockIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_sets")
        .select("block_id,session_id")
        .in("block_id", blockIds)
        .is("deleted_at", null)
        .gte("completed_at", sinceIso);
      if (error) throw error;
      return data as { block_id: string; session_id: string }[];
    },
  });
  return useMemo(() => {
    const seen = new Map<string, Set<string>>();
    [...(q.data ?? []), ...sets.filter((s) => s.block_id).map((s) => ({ block_id: s.block_id!, session_id: s.session_id }))].forEach((r) => {
      if (!seen.has(r.block_id)) seen.set(r.block_id, new Set());
      seen.get(r.block_id)!.add(r.session_id);
    });
    return seen;
  }, [q.data, sets]);
}

// ---- Past sessions ----

export type PastSession = { session: SessionRow; sets: SetRow[] };

export const usePastSessions = () =>
  useQuery({
    queryKey: ["past"],
    queryFn: async (): Promise<PastSession[]> => {
      const s = await supabase
        .from("sessions")
        .select("*")
        .not("ended_at", "is", null)
        .is("deleted_at", null)
        .order("started_at", { ascending: false })
        .limit(30);
      if (s.error) throw s.error;
      if (!s.data.length) return [];
      const sets = await supabase.from("session_sets").select(SET_COLUMNS).in("session_id", s.data.map((x) => x.id)).is("deleted_at", null);
      if (sets.error) throw sets.error;
      return s.data.map((session) => ({ session, sets: sets.data.filter((r) => r.session_id === session.id) }));
    },
  });

export function usePastSessionActions() {
  const refresh = invalidateDerived;
  return {
    async updateSet(id: string, patch: { weight_kg?: number; reps?: number }) {
      throwIf(await supabase.from("session_sets").update(patch).eq("id", id));
      refresh();
    },
    async deleteSet(id: string) {
      throwIf(await supabase.from("session_sets").update({ deleted_at: new Date().toISOString() }).eq("id", id));
      refresh();
    },
    async deleteSession(id: string) {
      await discardSession(id);
      refresh();
    },
  };
}
