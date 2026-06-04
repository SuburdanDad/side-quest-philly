import { describe, it, expect } from "vitest";
import { NEIGHBORHOODS, getAllObjectives } from "@/lib/data/neighborhoods";
import { ULTIMATE_QUEST_IDS } from "@/lib/data/quests";
import type { ObjectiveCategory } from "@/lib/types";

const VALID_CATEGORIES: ObjectiveCategory[] = [
  "culture",
  "history",
  "entertainment",
  "food-beverage",
];

describe("Quest data integrity", () => {
  it("has exactly 6 neighborhoods", () => {
    expect(NEIGHBORHOODS).toHaveLength(6);
  });

  it("each neighborhood has exactly 5 objectives", () => {
    for (const n of NEIGHBORHOODS) {
      expect(n.objectives).toHaveLength(5);
    }
  });

  it("total objectives is 30", () => {
    expect(getAllObjectives()).toHaveLength(30);
  });

  it("all objective IDs are unique", () => {
    const ids = getAllObjectives().map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all neighborhood slugs are unique", () => {
    const slugs = NEIGHBORHOODS.map((n) => n.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every objective has a valid category", () => {
    for (const obj of getAllObjectives()) {
      expect(VALID_CATEGORIES).toContain(obj.category);
    }
  });

  it("every objective has title, description, and hint", () => {
    for (const obj of getAllObjectives()) {
      expect(obj.title.length).toBeGreaterThan(0);
      expect(obj.description.length).toBeGreaterThan(0);
      expect(obj.hint.length).toBeGreaterThan(0);
    }
  });

  it("ultimate quest IDs all reference valid objectives", () => {
    const allIds = new Set(getAllObjectives().map((o) => o.id));
    for (const id of ULTIMATE_QUEST_IDS) {
      expect(allIds.has(id)).toBe(true);
    }
  });

  it("ultimate quest spans at least 4 different neighborhoods", () => {
    const allObjectives = getAllObjectives();
    const neighborhoodIds = new Set(
      ULTIMATE_QUEST_IDS.map((id) => {
        const obj = allObjectives.find((o) => o.id === id);
        const neighborhood = NEIGHBORHOODS.find((n) =>
          n.objectives.some((o) => o.id === obj?.id),
        );
        return neighborhood?.id;
      }),
    );
    expect(neighborhoodIds.size).toBeGreaterThanOrEqual(4);
  });
});
