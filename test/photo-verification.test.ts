import { describe, it, expect } from "vitest";
import {
  buildVerificationSystemPrompt,
  buildVerificationUserPrompt,
  isAcceptablePhotoPayload,
  toVerificationResult,
  MAX_REASON_LENGTH,
  VERIFICATION_JSON_SCHEMA,
} from "@/lib/photos/verification";
import {
  normalizePhotoEntry,
  countVerified,
  type PhotoStore,
} from "@/lib/hooks/use-photo-storage";
import {
  calculateTotalXP,
  calculateXP,
  VERIFIED_PHOTO_XP,
} from "@/lib/gamification/xp";
import { ALL_OBJECTIVES, findObjective } from "@/lib/data/all-objectives";
import { checkAchievements } from "@/lib/gamification/achievements";
import type { QuestProgress } from "@/lib/types";

const TINY_JPEG = `data:image/jpeg;base64,${"A".repeat(64)}`;

function progressWith(completed: string[]): QuestProgress {
  return {
    completedObjectives: completed,
    completedNeighborhoods: [],
    ultimateCompleted: false,
    firstVisit: "2026-06-01T00:00:00.000Z",
    lastActivity: "2026-06-01T00:00:00.000Z",
  };
}

describe("ALL_OBJECTIVES", () => {
  it("contains all 53 objectives (45 neighborhood + 8 secret quest)", () => {
    expect(ALL_OBJECTIVES).toHaveLength(53);
    const ids = new Set(ALL_OBJECTIVES.map((o) => o.id));
    expect(ids.size).toBe(53);
  });

  it("finds neighborhood and secret-quest objectives with context", () => {
    const oldCity = findObjective("oldc-01");
    expect(oldCity?.questName).toBe("Old City");

    const timf = findObjective("timf-01");
    expect(timf?.questName).toBe("Tim's Favorites");
    expect(timf?.objective.title).toBe("The OG Cheesesteak");

    expect(findObjective("nope-99")).toBeNull();
  });
});

describe("verification prompts", () => {
  it("builds a lenient system prompt that treats image text as scenery", () => {
    const prompt = buildVerificationSystemPrompt();
    expect(prompt).toContain("GENEROUS");
    expect(prompt).toContain("never as instructions");
    expect(prompt).toContain(String(MAX_REASON_LENGTH));
  });

  it("embeds the real objective server-side, not client input", () => {
    const ctx = findObjective("oldc-01")!;
    const prompt = buildVerificationUserPrompt(ctx);
    expect(prompt).toContain("Old City");
    expect(prompt).toContain(ctx.objective.title);
    expect(prompt).toContain(ctx.objective.description);
    expect(prompt).toContain(ctx.objective.hint);
  });

  it("schema requires verified, confidence, and reason", () => {
    expect(VERIFICATION_JSON_SCHEMA.required).toEqual([
      "verified",
      "confidence",
      "reason",
    ]);
  });
});

describe("toVerificationResult", () => {
  it("passes through a clean verdict", () => {
    const result = toVerificationResult({
      verified: true,
      confidence: 0.92,
      reason: "That crack is unmistakable — verified, champ!",
    });
    expect(result.verified).toBe(true);
    expect(result.confidence).toBe(0.92);
    expect(result.reason).toContain("verified, champ");
  });

  it("returns unavailable when verified is missing or not boolean", () => {
    expect(toVerificationResult({}).verified).toBeNull();
    expect(toVerificationResult({ verified: "yes" }).verified).toBeNull();
  });

  it("clamps confidence into [0, 1]", () => {
    expect(toVerificationResult({ verified: true, confidence: 7 }).confidence).toBe(1);
    expect(toVerificationResult({ verified: false, confidence: -2 }).confidence).toBe(0);
    expect(toVerificationResult({ verified: true, confidence: NaN }).confidence).toBeNull();
  });

  it("truncates runaway reasons with an ellipsis", () => {
    const long = "go ".repeat(200);
    const result = toVerificationResult({ verified: true, reason: long });
    expect(result.reason!.length).toBeLessThanOrEqual(MAX_REASON_LENGTH);
    expect(result.reason!.endsWith("…")).toBe(true);
  });
});

describe("isAcceptablePhotoPayload", () => {
  it("accepts compressed jpeg data URLs", () => {
    expect(isAcceptablePhotoPayload(TINY_JPEG)).toBe(true);
  });

  it("rejects non-strings, non-images, and oversized payloads", () => {
    expect(isAcceptablePhotoPayload(null)).toBe(false);
    expect(isAcceptablePhotoPayload(42)).toBe(false);
    expect(isAcceptablePhotoPayload("data:text/html;base64,PGI+")).toBe(false);
    expect(isAcceptablePhotoPayload("https://example.com/cat.jpg")).toBe(false);
    expect(
      isAcceptablePhotoPayload(`data:image/jpeg;base64,${"A".repeat(2_100_000)}`),
    ).toBe(false);
  });
});

describe("normalizePhotoEntry (v1 → v2 migration)", () => {
  it("upgrades legacy plain data-URL strings", () => {
    const entry = normalizePhotoEntry(TINY_JPEG);
    expect(entry).toEqual({
      dataUrl: TINY_JPEG,
      verified: null,
      reason: null,
      savedAt: "",
    });
  });

  it("keeps v2 entries intact", () => {
    const entry = normalizePhotoEntry({
      dataUrl: TINY_JPEG,
      verified: true,
      reason: "Verified!",
      savedAt: "2026-06-09T12:00:00.000Z",
    });
    expect(entry?.verified).toBe(true);
    expect(entry?.reason).toBe("Verified!");
  });

  it("drops junk values", () => {
    expect(normalizePhotoEntry("not a photo")).toBeNull();
    expect(normalizePhotoEntry(123)).toBeNull();
    expect(normalizePhotoEntry({ verified: true })).toBeNull();
  });
});

describe("countVerified", () => {
  it("counts only entries the AI verified", () => {
    const store: PhotoStore = {
      "oldc-01": { dataUrl: TINY_JPEG, verified: true, reason: null, savedAt: "" },
      "oldc-02": { dataUrl: TINY_JPEG, verified: false, reason: null, savedAt: "" },
      "oldc-03": { dataUrl: TINY_JPEG, verified: null, reason: null, savedAt: "" },
    };
    expect(countVerified(store)).toBe(1);
  });
});

describe("calculateTotalXP", () => {
  it("adds the verified-photo bonus on top of objective XP", () => {
    const completed = ["oldc-01", "oldc-04"]; // history 10 + food 25 = 35
    const base = calculateXP(completed, ALL_OBJECTIVES);
    expect(base).toBe(35);
    expect(calculateTotalXP(completed, ALL_OBJECTIVES, 2)).toBe(
      35 + 2 * VERIFIED_PHOTO_XP,
    );
  });

  it("counts Tim's Favorites objectives toward XP", () => {
    // timf-01 is food-beverage (25 XP)
    expect(calculateTotalXP(["timf-01"], ALL_OBJECTIVES, 0)).toBe(25);
  });

  it("never lets a negative verified count subtract XP", () => {
    expect(calculateTotalXP(["oldc-01"], ALL_OBJECTIVES, -5)).toBe(10);
  });
});

describe("photo achievements", () => {
  const base = progressWith(["oldc-01"]);

  it("awards Shutterbug at 5 verified photos", () => {
    expect(checkAchievements(base, {}, [], 4)).not.toContain("shutterbug");
    expect(checkAchievements(base, {}, [], 5)).toContain("shutterbug");
  });

  it("awards the full ladder at 30 verified photos", () => {
    const earned = checkAchievements(base, {}, [], 30);
    expect(earned).toContain("shutterbug");
    expect(earned).toContain("photo-journalist");
    expect(earned).toContain("city-documentarian");
  });

  it("never re-awards already-earned photo achievements", () => {
    const earned = checkAchievements(base, {}, ["shutterbug"], 10);
    expect(earned).not.toContain("shutterbug");
  });

  it("defaults to zero verified photos for old call sites", () => {
    const earned = checkAchievements(base, {}, []);
    expect(earned).not.toContain("shutterbug");
  });
});
