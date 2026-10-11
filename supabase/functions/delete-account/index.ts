import { createClient } from "npm:@supabase/supabase-js@2";
import { handle } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  // Unauthenticated requests of any method get the same answer, so a health probe cannot learn anything else.
  if (!req.headers.get("Authorization")) return Response.json({ error: "Sign in again, then retry." }, { status: 401, headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    /* handled as a failed confirmation */
  }
  try {
    const out = await handle(req.headers.get("Authorization"), body, {
      async userFor(jwt) {
        const { data, error } = await admin.auth.getUser(jwt);
        return error || !data.user ? null : { id: data.user.id, email: data.user.email ?? null };
      },
      async deleteUser(id) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
      },
    });
    return Response.json(out.body, { status: out.status, headers: cors });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500, headers: cors });
  }
});
