import { describe, it, expect } from "vitest";
import { resolveFirstTouchSrc } from "@/lib/analytics";

describe("resolveFirstTouchSrc (first touch wins)", () => {
  it("keeps the stored source when one exists", () => {
    expect(resolveFirstTouchSrc("qr-old-city", "ig")).toBe("qr-old-city");
  });

  it("adopts the URL source on first touch", () => {
    expect(resolveFirstTouchSrc(null, "qr-fishtown")).toBe("qr-fishtown");
  });

  it("returns null when neither exists", () => {
    expect(resolveFirstTouchSrc(null, null)).toBeNull();
    expect(resolveFirstTouchSrc("", "")).toBeNull();
  });

  it("trims and caps the URL source at 64 chars", () => {
    expect(resolveFirstTouchSrc(null, "  ig  ")).toBe("ig");
    expect(resolveFirstTouchSrc(null, "x".repeat(100))!.length).toBe(64);
  });

  it("ignores whitespace-only stored values", () => {
    expect(resolveFirstTouchSrc("   ", "qr-philly")).toBe("qr-philly");
  });
});
