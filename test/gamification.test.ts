import { describe, it, expect } from "vitest";
import { NEIGHBORHOODS, getAllObjectives } from "@/lib/data/neighborhoods";
import {
  CATEGORY_XP,
  LEVELS,
  getLevel,
  getNextLevel,
  getLevelProgress,
  calculateXP,
} from "@/lib/gamification/xp";
import {
  ACHIEVEMENTS,
  checkAchievements,
} from "@/lib/gamification/achievements";
import type { QuestProgress } from "@/lib/types";

// ─── XP System ───────────────────────────────────────────────

describe("XP system", () => {
  it("has XP values for all four categories", () => {
    expect(CATEGORY_XP.history).toBe(10);
    expect(CATEGORY_XP.culture).toBe(15);
    expect(CATEGORY_XP.entertainment).toBe(20);
    expect(CATEGORY_XP["food-beverage"]).toBe(25);
  });

  it("XP values increase by category order", () => {
    expect(CATEGORY_XP.history).toBeLessThan(CATEGORY_XP.culture);
    expect(CATEGORY_XP.culture).toBeLessThan(CATEGORY_XP.entertainment);
    expect(CATEGORY_XP.entertainment).toBeLessThan(CATEGORY_XP["food-beverage"]);
  });

  it("calculateXP returns 0 with no completions", () => {
    const all = getAllObjectives().map((o) => ({ id: o.id, category: o.category }));
    expect(calculateXP([], all)).toBe(0);
  });

  it("calculateXP sums correct values for completed objectives", () => {
    const all = getAllObjectives().map((o) => ({ id: o.id, category: o.category }));
    // Complete Old City's first objective (history = 10 XP)
    const oldCityHistory = NEIGHBORHOODS[0].objectives.find(
      (o) => o.category === "history",
    )!;
    expect(calculateXP([oldCityHistory.id], all)).toBe(10);
  });

  it("calculateXP handles all 45 objectives", () => {
    const all = getAllObjectives().map((o) => ({ id: o.id, category: o.category }));
    const allIds = all.map((o) => o.id);
    const totalXP = calculateXP(allIds, all);
    // Total should be positive and reasonable (each obj is 10-25 XP, 45 objectives)
    expect(totalXP).toBeGreaterThan(0);
    expect(totalXP).toBeLessThanOrEqual(45 * 25); // Max if all were food-beverage
    expect(totalXP).toBeGreaterThanOrEqual(45 * 10); // Min if all were history
  });

  it("ignores unknown objective IDs", () => {
    const all = getAllObjectives().map((o) => ({ id: o.id, category: o.category }));
    expect(calculateXP(["fake-id-1", "fake-id-2"], all)).toBe(0);
  });
});

// ─── Levels ──────────────────────────────────────────────────

describe("Level system", () => {
  it("has 5 levels in ascending XP order", () => {
    expect(LEVELS).toHaveLength(5);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minXP).toBeGreaterThan(LEVELS[i - 1].minXP);
    }
  });

  it("first level starts at 0 XP", () => {
    expect(LEVELS[0].minXP).toBe(0);
  });

  it("getLevel returns Tourist at 0 XP", () => {
    expect(getLevel(0).name).toBe("Tourist");
  });

  it("getLevel returns Explorer at 50 XP", () => {
    expect(getLevel(50).name).toBe("Explorer");
  });

  it("getLevel returns Philly Native at 500+ XP", () => {
    expect(getLevel(500).name).toBe("Philly Native");
    expect(getLevel(999).name).toBe("Philly Native");
  });

  it("getLevel returns correct level at boundary values", () => {
    expect(getLevel(49).name).toBe("Tourist");
    expect(getLevel(50).name).toBe("Explorer");
    expect(getLevel(149).name).toBe("Explorer");
    expect(getLevel(150).name).toBe("Adventurer");
    expect(getLevel(299).name).toBe("Adventurer");
    expect(getLevel(300).name).toBe("Local Legend");
  });

  it("getNextLevel returns null at max level", () => {
    expect(getNextLevel(500)).toBeNull();
    expect(getNextLevel(999)).toBeNull();
  });

  it("getNextLevel returns Explorer for Tourist", () => {
    expect(getNextLevel(0)?.name).toBe("Explorer");
    expect(getNextLevel(49)?.name).toBe("Explorer");
  });

  it("getLevelProgress returns 0 at level start", () => {
    expect(getLevelProgress(0)).toBe(0);
    expect(getLevelProgress(50)).toBe(0);
  });

  it("getLevelProgress returns 1 at max level", () => {
    expect(getLevelProgress(500)).toBe(1);
  });

  it("getLevelProgress returns correct mid-level progress", () => {
    // Tourist: 0-50, at 25 = 50%
    expect(getLevelProgress(25)).toBeCloseTo(0.5);
    // Explorer: 50-150, at 100 = 50%
    expect(getLevelProgress(100)).toBeCloseTo(0.5);
  });

  it("max possible XP can reach Philly Native", () => {
    const all = getAllObjectives().map((o) => ({ id: o.id, category: o.category }));
    const allIds = all.map((o) => o.id);
    const totalXP = calculateXP(allIds, all);
    expect(getLevel(totalXP).name).toBe("Philly Native");
  });
});

// ─── Achievements ────────────────────────────────────────────

describe("Achievement definitions", () => {
  it("has 16 achievements", () => {
    expect(ACHIEVEMENTS).toHaveLength(16);
  });

  it("all achievement IDs are unique", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every achievement has name, description, icon, and rarity", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
      expect(["common", "rare", "legendary"]).toContain(a.rarity);
    }
  });

  it("has at least one achievement of each rarity", () => {
    const rarities = new Set(ACHIEVEMENTS.map((a) => a.rarity));
    expect(rarities.has("common")).toBe(true);
    expect(rarities.has("rare")).toBe(true);
    expect(rarities.has("legendary")).toBe(true);
  });

  it("event-based achievements have valid date ranges", () => {
    const eventAchievements = ACHIEVEMENTS.filter((a) => a.dateRange);
    expect(eventAchievements.length).toBeGreaterThan(0);
    for (const a of eventAchievements) {
      const start = new Date(a.dateRange!.start);
      const end = new Date(a.dateRange!.end);
      expect(start.getTime()).toBeLessThan(end.getTime());
      // Both should be in 2026
      expect(start.getFullYear()).toBe(2026);
      expect(end.getFullYear()).toBe(2026);
    }
  });
});

describe("Achievement check logic", () => {
  const emptyProgress: QuestProgress = {
    completedObjectives: [],
    completedNeighborhoods: [],
    ultimateCompleted: false,
    firstVisit: "",
    lastActivity: "",
  };

  it("returns empty array with no progress", () => {
    const result = checkAchievements(emptyProgress, {}, []);
    expect(result).toEqual([]);
  });

  it("awards first-blood on first objective completion", () => {
    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: ["oldc-01"],
    };
    const result = checkAchievements(progress, {}, []);
    expect(result).toContain("first-blood");
  });

  it("awards neighborhood-native when a neighborhood is completed", () => {
    const oldCityIds = NEIGHBORHOODS[0].objectives.map((o) => o.id);
    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: oldCityIds,
      completedNeighborhoods: ["old-city"],
    };
    const result = checkAchievements(progress, {}, []);
    expect(result).toContain("neighborhood-native");
  });

  it("does not re-award already earned achievements", () => {
    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: ["oldc-01"],
    };
    const result = checkAchievements(progress, {}, ["first-blood"]);
    expect(result).not.toContain("first-blood");
  });

  it("awards halfway-hero at 23+ objectives", () => {
    const allObjs = getAllObjectives();
    const first23 = allObjs.slice(0, 23).map((o) => o.id);
    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: first23,
    };
    const result = checkAchievements(progress, {}, []);
    expect(result).toContain("halfway-hero");
  });

  it("does not award halfway-hero at 22 objectives", () => {
    const allObjs = getAllObjectives();
    const first22 = allObjs.slice(0, 22).map((o) => o.id);
    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: first22,
    };
    const result = checkAchievements(progress, {}, []);
    expect(result).not.toContain("halfway-hero");
  });

  it("awards completionist at all 45 objectives", () => {
    const allIds = getAllObjectives().map((o) => o.id);
    const allHoodIds = NEIGHBORHOODS.map((n) => n.id);
    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: allIds,
      completedNeighborhoods: allHoodIds,
    };
    const result = checkAchievements(progress, {}, []);
    expect(result).toContain("completionist");
  });

  it("awards category achievements when all objectives in a category are done", () => {
    const allObjs = getAllObjectives();
    const historyIds = allObjs
      .filter((o) => o.category === "history")
      .map((o) => o.id);
    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: historyIds,
    };
    const result = checkAchievements(progress, {}, []);
    expect(result).toContain("historian");
    expect(result).not.toContain("foodie");
  });

  it("awards speed-runner for a neighborhood done in under 3 hours", () => {
    const oldCityIds = NEIGHBORHOODS[0].objectives.map((o) => o.id);
    const now = new Date("2026-06-15T12:00:00Z");
    const completedAt: Record<string, string> = {};
    oldCityIds.forEach((id, i) => {
      // Each 30 min apart = 2 hours total
      const ts = new Date(now.getTime() + i * 30 * 60 * 1000);
      completedAt[id] = ts.toISOString();
    });

    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: oldCityIds,
      completedNeighborhoods: ["old-city"],
    };
    const result = checkAchievements(progress, completedAt, []);
    expect(result).toContain("speed-runner");
  });

  it("does not award speed-runner for a neighborhood done over 3 hours", () => {
    const oldCityIds = NEIGHBORHOODS[0].objectives.map((o) => o.id);
    const now = new Date("2026-06-15T12:00:00Z");
    const completedAt: Record<string, string> = {};
    oldCityIds.forEach((id, i) => {
      // Each 1 hour apart = 4 hours total
      const ts = new Date(now.getTime() + i * 60 * 60 * 1000);
      completedAt[id] = ts.toISOString();
    });

    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: oldCityIds,
      completedNeighborhoods: ["old-city"],
    };
    const result = checkAchievements(progress, completedAt, []);
    expect(result).not.toContain("speed-runner");
  });

  it("awards double-feature for 2 neighborhoods in one day", () => {
    const hood1 = NEIGHBORHOODS[0].objectives.map((o) => o.id);
    const hood2 = NEIGHBORHOODS[1].objectives.map((o) => o.id);
    const completedAt: Record<string, string> = {};

    // All in same day
    hood1.forEach((id, i) => {
      completedAt[id] = `2026-06-15T${10 + i}:00:00Z`;
    });
    hood2.forEach((id, i) => {
      completedAt[id] = `2026-06-15T${15 + i}:00:00Z`;
    });

    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: [...hood1, ...hood2],
      completedNeighborhoods: [NEIGHBORHOODS[0].id, NEIGHBORHOODS[1].id],
    };
    const result = checkAchievements(progress, completedAt, []);
    expect(result).toContain("double-feature");
  });

  it("can earn multiple achievements at once", () => {
    const oldCityIds = NEIGHBORHOODS[0].objectives.map((o) => o.id);
    const now = new Date("2026-06-15T12:00:00Z");
    const completedAt: Record<string, string> = {};
    oldCityIds.forEach((id, i) => {
      const ts = new Date(now.getTime() + i * 20 * 60 * 1000);
      completedAt[id] = ts.toISOString();
    });

    const progress: QuestProgress = {
      ...emptyProgress,
      completedObjectives: oldCityIds,
      completedNeighborhoods: ["old-city"],
    };
    const result = checkAchievements(progress, completedAt, []);
    // Should get at least: first-blood, neighborhood-native, speed-runner
    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});
