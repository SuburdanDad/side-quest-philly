import { describe, it, expect } from "vitest";
import { CHAPTER_II, CHAPTER_II_OBJECTIVES } from "@/lib/data/chapters";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { TIMS_FAVORITES } from "@/lib/data/secret-quests";
import { ALL_OBJECTIVES, findObjective } from "@/lib/data/all-objectives";

const VALID_CATEGORIES = new Set([
  "history",
  "culture",
  "entertainment",
  "food-beverage",
]);

describe("Chapter II content wave", () => {
  it("covers every neighborhood with exactly 5 objectives", () => {
    expect(Object.keys(CHAPTER_II)).toHaveLength(NEIGHBORHOODS.length);
    for (const n of NEIGHBORHOODS) {
      expect(CHAPTER_II[n.id], `missing chapter for ${n.id}`).toHaveLength(5);
    }
  });

  it("has 45 objectives with globally unique ids", () => {
    expect(CHAPTER_II_OBJECTIVES).toHaveLength(45);
    const ids = CHAPTER_II_OBJECTIVES.map((o) => o.id);
    expect(new Set(ids).size).toBe(45);
  });

  it("never collides with core or secret-quest ids", () => {
    const existing = new Set([
      ...NEIGHBORHOODS.flatMap((n) => n.objectives.map((o) => o.id)),
      ...TIMS_FAVORITES.objectives.map((o) => o.id),
    ]);
    for (const o of CHAPTER_II_OBJECTIVES) {
      expect(existing.has(o.id), `${o.id} collides`).toBe(false);
    }
  });

  it("uses only valid categories and complete content", () => {
    for (const o of CHAPTER_II_OBJECTIVES) {
      expect(VALID_CATEGORIES.has(o.category), `${o.id} category`).toBe(true);
      expect(o.title.length).toBeGreaterThan(3);
      expect(o.description.length).toBeGreaterThan(20);
      expect(o.hint.length).toBeGreaterThan(10);
      expect(o.funFact, `${o.id} needs a fun fact`).toBeTruthy();
    }
  });

  it("follows the chapter id convention {prefix}2-NN", () => {
    for (const o of CHAPTER_II_OBJECTIVES) {
      expect(o.id).toMatch(/^[a-z]{4}2-0[1-5]$/);
    }
  });

  it("ALL_OBJECTIVES spans core + secret + chapters (98 total)", () => {
    expect(ALL_OBJECTIVES).toHaveLength(98);
    const ids = new Set(ALL_OBJECTIVES.map((o) => o.id));
    expect(ids.size).toBe(98);
  });

  it("findObjective resolves chapter objectives with chapter context", () => {
    const ctx = findObjective("oldc2-01");
    expect(ctx?.questId).toBe("old-city-ch2");
    expect(ctx?.questName).toBe("Old City — Chapter II");
    expect(ctx?.objective.title).toBe("Carpenters' Hall Huddle");
  });

  it("chapter objectives never affect stamps (not in NEIGHBORHOODS)", () => {
    const coreIds = new Set(
      NEIGHBORHOODS.flatMap((n) => n.objectives.map((o) => o.id)),
    );
    for (const o of CHAPTER_II_OBJECTIVES) {
      expect(coreIds.has(o.id)).toBe(false);
    }
  });
});
