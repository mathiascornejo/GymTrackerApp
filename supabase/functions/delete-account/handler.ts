// Deleting an account is the one operation that needs the service-role key, so it lives here and nowhere in the client.

export type Deps = {
  /** Resolves a user JWT to the user it belongs to, or null when invalid or expired. */
  userFor: (jwt: string) => Promise<{ id: string; email: string | null } | null>;
  /** Deletes the auth user; every owned row goes with it (ON DELETE CASCADE). */
  deleteUser: (id: string) => Promise<void>;
};

export type Outcome = { status: number; body: { ok: true } | { error: string } };

export async function handle(authHeader: string | null, body: unknown, deps: Deps): Promise<Outcome> {
  const jwt = (authHeader ?? "").replace(/^Bearer /, "");
  if (!jwt) return { status: 401, body: { error: "Sign in again, then retry." } };
  const user = await deps.userFor(jwt);
  if (!user) return { status: 401, body: { error: "Your session has expired. Sign in again, then retry." } };

  // The client asks the user to type their email; require the same here so a stray request cannot delete anything.
  const confirm = (body as { confirm?: unknown } | null)?.confirm;
  if (typeof confirm !== "string" || !user.email || confirm.trim().toLowerCase() !== user.email.toLowerCase())
    return { status: 400, body: { error: "The confirmation did not match your account email." } };

  await deps.deleteUser(user.id); // only the caller's own id, never one supplied in the request
  return { status: 200, body: { ok: true } };
}
