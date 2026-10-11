import { describe, expect, it } from "vitest";
import { parseHash } from "./routes";

describe("parseHash", () => {
  it("maps known tabs", () => {
    expect(parseHash("#/log")).toBe("log");
    expect(parseHash("#/library/ds:abc")).toBe("library");
    expect(parseHash("#/settings")).toBe("settings");
  });
  it("falls back to dashboard", () => {
    expect(parseHash("")).toBe("dashboard");
    expect(parseHash("#/nope")).toBe("dashboard");
  });
});
