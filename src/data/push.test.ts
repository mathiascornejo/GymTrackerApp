import { describe, expect, it } from "vitest";
import { isIos, urlBase64ToUint8Array } from "./push";

describe("urlBase64ToUint8Array", () => {
  it("decodes base64url with and without padding", () => {
    expect([...urlBase64ToUint8Array("AQID")]).toEqual([1, 2, 3]);
    expect([...urlBase64ToUint8Array("_-8")]).toEqual([255, 239]);
  });
  it("produces the 65 bytes of an uncompressed P-256 key", () => {
    const key = btoa(String.fromCharCode(4, ...Array(64).fill(7))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(urlBase64ToUint8Array(key)).toHaveLength(65);
  });
});

describe("isIos", () => {
  it("recognises iPhone, iPad and iPadOS desktop-mode Safari", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIos("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
  });
  it("is false for desktop and Android", () => {
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isIos("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });
});
