import { describe, expect, it } from "vitest";
import { handle, type Deps } from "./handler";

const user = { id: "u1", email: "me@example.com" };
const deps = (over: Partial<Deps> = {}) => {
  const deleted: string[] = [];
  const d: Deps = { userFor: async (jwt) => (jwt === "good" ? user : null), deleteUser: async (id) => void deleted.push(id), ...over };
  return { d, deleted };
};

describe("delete-account", () => {
  it("rejects a missing or invalid session without deleting anything", async () => {
    const { d, deleted } = deps();
    expect((await handle(null, { confirm: user.email }, d)).status).toBe(401);
    expect((await handle("Bearer bad", { confirm: user.email }, d)).status).toBe(401);
    expect(deleted).toEqual([]);
  });

  it("requires the email to be typed back", async () => {
    const { d, deleted } = deps();
    expect((await handle("Bearer good", {}, d)).status).toBe(400);
    expect((await handle("Bearer good", { confirm: "someone@else.com" }, d)).status).toBe(400);
    expect((await handle("Bearer good", null, d)).status).toBe(400);
    expect(deleted).toEqual([]);
  });

  it("deletes only the caller, matching the email case-insensitively", async () => {
    const { d, deleted } = deps();
    const out = await handle("Bearer good", { confirm: " ME@example.com ", userId: "someone-else" }, d);
    expect(out).toEqual({ status: 200, body: { ok: true } });
    expect(deleted).toEqual(["u1"]);
  });
});
