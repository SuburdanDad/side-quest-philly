import { describe, it, expect } from "vitest";
import { classifyDevice } from "@/lib/device";
import { dayKey } from "@/lib/analytics";

describe("classifyDevice", () => {
  it("classifies iPhones and Android phones as mobile", () => {
    expect(
      classifyDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe("mobile");
    expect(
      classifyDevice(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari",
      ),
    ).toBe("mobile");
  });

  it("classifies iPads and non-mobile Android as tablet", () => {
    expect(
      classifyDevice("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)"),
    ).toBe("tablet");
    expect(
      classifyDevice("Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit"),
    ).toBe("tablet");
  });

  it("classifies desktop browsers as desktop", () => {
    expect(
      classifyDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      ),
    ).toBe("desktop");
    expect(
      classifyDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"),
    ).toBe("desktop");
  });

  it("returns null for missing or junk user agents", () => {
    expect(classifyDevice(null)).toBeNull();
    expect(classifyDevice("curl/8.4.0")).toBeNull();
  });
});

describe("dayKey", () => {
  it("formats a stable YYYY-MM-DD key", () => {
    expect(dayKey(new Date("2026-06-11T15:30:00Z"))).toBe("2026-06-11");
  });
});
