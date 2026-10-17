import { describe, expect, it } from "vitest";
import { dropIntent } from "./dropIntent";

const rect = { top: 100, height: 100 };

describe("dropIntent", () => {
  it("reads the top 30% as before, the middle 40% as center, the bottom 30% as after", () => {
    expect(dropIntent(100, rect)).toBe("before");
    expect(dropIntent(129, rect)).toBe("before");
    expect(dropIntent(130, rect)).toBe("center");
    expect(dropIntent(150, rect)).toBe("center");
    expect(dropIntent(170, rect)).toBe("center");
    expect(dropIntent(171, rect)).toBe("after");
    expect(dropIntent(200, rect)).toBe("after");
  });
});
