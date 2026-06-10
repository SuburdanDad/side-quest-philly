import type { ObjectiveCategory } from "@/lib/types";
import type { Level } from "./types";

export const CATEGORY_XP: Record<ObjectiveCategory, number> = {
  history: 10,
  culture: 15,
  entertainment: 20,
  "food-beverage": 25, // End on a high note - food is the reward
};

/** Bonus XP per objective whose photo passed AI verification. */
export const VERIFIED_PHOTO_XP = 5;

export const LEVELS: Level[] = [
  { name: "Tourist", minXP: 0, emoji: "\u{1F5FA}️" },
  { name: "Explorer", minXP: 50, emoji: "\u{1F9ED}" },
  { name: "Adventurer", minXP: 150, emoji: "⚡" },
  { name: "Local Legend", minXP: 300, emoji: "\u{1F3C6}" },
  { name: "Philly Native", minXP: 500, emoji: "\u{1F514}" },
];
// Max possible XP: 45 objectives * ~17.5 avg = ~788 XP
// Philly Native requires ~64% completion - achievable but not trivial

export function getLevel(xp: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.minXP) current = level;
    else break;
  }
  return current;
}

export function getNextLevel(xp: number): Level | null {
  for (const level of LEVELS) {
    if (xp < level.minXP) return level;
  }
  return null; // Max level reached
}

export function getLevelProgress(xp: number): number {
  const current = getLevel(xp);
  const next = getNextLevel(xp);
  if (!next) return 1; // Max level
  const range = next.minXP - current.minXP;
  const progress = xp - current.minXP;
  return progress / range;
}

export function calculateXP(
  completedObjectiveIds: string[],
  allObjectives: { id: string; category: ObjectiveCategory }[],
): number {
  let total = 0;
  for (const obj of allObjectives) {
    if (completedObjectiveIds.includes(obj.id)) {
      total += CATEGORY_XP[obj.category];
    }
  }
  return total;
}

/**
 * Objective XP plus the verified-photo bonus. This is the number shown
 * everywhere in the app, and the get_leaderboard() Postgres function
 * computes the same formula server-side — keep them in sync.
 */
export function calculateTotalXP(
  completedObjectiveIds: string[],
  allObjectives: { id: string; category: ObjectiveCategory }[],
  verifiedPhotoCount: number,
): number {
  return (
    calculateXP(completedObjectiveIds, allObjectives) +
    Math.max(0, verifiedPhotoCount) * VERIFIED_PHOTO_XP
  );
}
