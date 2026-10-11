import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const configured = Boolean(url && key);

// Placeholders keep module load from throwing when unconfigured (CI passes empty strings, hence ||); the app shows a setup screen instead.
export const supabase = createClient(url || "http://localhost", key || "unconfigured");
