import type { Achievement } from "./types";
import type { QuestProgress } from "@/lib/types";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { TIMS_FAVORITES } from "@/lib/data/secret-quests";

export const ACHIEVEMENTS: Achievement[] = [
  // Completion-based
  {
    id: "first-blood",
    name: "First Blood",
    description: "Complete your first objective",
    rarity: "common",
    icon: "⭐",
  },
  {
    id: "neighborhood-native",
    name: "Neighborhood Native",
    description: "Complete an entire neighborhood",
    rarity: "common",
    icon: "\u{1F3E0}",
  },
  {
    id: "halfway-hero",
    name: "Halfway Hero",
    description: "Complete 50% of all objectives",
    rarity: "rare",
    icon: "\u{1F9B8}",
  },
  {
    id: "completionist",
    name: "Completionist",
    description: "Complete all 45 objectives",
    rarity: "legendary",
    icon: "\u{1F451}",
  },

  // Category-based
  {
    id: "historian",
    name: "Historian",
    description: "Complete all History objectives across the city",
    rarity: "rare",
    icon: "\u{1F4DC}",
  },
  {
    id: "culture-vulture",
    name: "Culture Vulture",
    description: "Complete all Culture objectives",
    rarity: "rare",
    icon: "\u{1F3AD}",
  },
  {
    id: "foodie",
    name: "Foodie",
    description: "Complete all Food & Drink objectives",
    rarity: "rare",
    icon: "\u{1F355}",
  },
  {
    id: "party-animal",
    name: "Party Animal",
    description: "Complete all Entertainment objectives",
    rarity: "rare",
    icon: "\u{1F389}",
  },

  // Speed/combo-based
  {
    id: "speed-runner",
    name: "Speed Runner",
    description: "Complete a neighborhood in under 3 hours",
    rarity: "rare",
    icon: "⚡",
  },
  {
    id: "double-feature",
    name: "Double Feature",
    description: "Complete 2 neighborhoods in one day",
    rarity: "rare",
    icon: "\u{1F3AC}",
  },
  {
    id: "hat-trick",
    name: "Hat Trick",
    description: "Complete 3 neighborhoods in one day",
    rarity: "legendary",
    icon: "\u{1F3A9}",
  },

  // Time-based
  {
    id: "night-owl",
    name: "Night Owl",
    description: "Complete an objective after 10pm",
    rarity: "common",
    icon: "\u{1F989}",
  },
  {
    id: "early-bird",
    name: "Early Bird",
    description: "Complete an objective before 8am",
    rarity: "common",
    icon: "\u{1F426}",
  },

  // Event-based
  {
    id: "world-cup-explorer",
    name: "World Cup Explorer",
    description: "Complete Stadium District during the World Cup",
    rarity: "legendary",
    icon: "⚽",
    dateRange: { start: "2026-06-11", end: "2026-07-19" },
  },
  {
    id: "founding-father",
    name: "Founding Father",
    description: "Complete Old City during America 250",
    rarity: "legendary",
    icon: "\u{1F514}",
    dateRange: { start: "2026-06-01", end: "2026-09-07" },
  },

  // Secret quest
  {
    id: "inner-circle",
    name: "Inner Circle",
    description: "Complete Tim's Favorites secret quest",
    rarity: "legendary",
    icon: "🤫",
  },

  // Photo verification
  {
    id: "shutterbug",
    name: "Shutterbug",
    description: "Get 5 photos AI-verified",
    rarity: "common",
    icon: "\u{1F4F8}",
  },
  {
    id: "photo-journalist",
    name: "Photo Journalist",
    description: "Get 15 photos AI-verified",
    rarity: "rare",
    icon: "\u{1F4F0}",
  },
  {
    id: "city-documentarian",
    name: "City Documentarian",
    description: "Get 30 photos AI-verified",
    rarity: "legendary",
    icon: "\u{1F39E}️",
  },
];

const allObjectives = NEIGHBORHOODS.flatMap((n) => n.objectives);

export function checkAchievements(
  progress: QuestProgress,
  objectiveCompletedAt: Record<string, string>,
  alreadyEarned: string[],
  verifiedPhotoCount = 0,
): string[] {
  const newAchievements: string[] = [];
  const now = new Date();

  for (const achievement of ACHIEVEMENTS) {
    if (alreadyEarned.includes(achievement.id)) continue;

    let earned = false;

    switch (achievement.id) {
      case "first-blood":
        earned = progress.completedObjectives.length >= 1;
        break;

      case "neighborhood-native":
        earned = progress.completedNeighborhoods.length >= 1;
        break;

      case "halfway-hero":
        earned = progress.completedObjectives.length >= 23; // 45 / 2 rounded up
        break;

      case "completionist":
        earned = progress.completedObjectives.length >= 45;
        break;

      case "historian":
        earned = allObjectives
          .filter((o) => o.category === "history")
          .every((o) => progress.completedObjectives.includes(o.id));
        break;

      case "culture-vulture":
        earned = allObjectives
          .filter((o) => o.category === "culture")
          .every((o) => progress.completedObjectives.includes(o.id));
        break;

      case "foodie":
        earned = allObjectives
          .filter((o) => o.category === "food-beverage")
          .every((o) => progress.completedObjectives.includes(o.id));
        break;

      case "party-animal":
        earned = allObjectives
          .filter((o) => o.category === "entertainment")
          .every((o) => progress.completedObjectives.includes(o.id));
        break;

      case "night-owl": {
        const hour = now.getHours();
        earned =
          hour >= 22 && progress.completedObjectives.length > 0;
        break;
      }

      case "early-bird": {
        const hour = now.getHours();
        earned =
          hour < 8 && progress.completedObjectives.length > 0;
        break;
      }

      case "speed-runner":
        earned = checkSpeedRunner(objectiveCompletedAt);
        break;

      case "double-feature":
        earned = checkNeighborhoodsInDay(objectiveCompletedAt, 2);
        break;

      case "hat-trick":
        earned = checkNeighborhoodsInDay(objectiveCompletedAt, 3);
        break;

      case "world-cup-explorer":
        earned = checkEventAchievement(
          progress,
          "stadium-district",
          achievement.dateRange!,
        );
        break;

      case "founding-father":
        earned = checkEventAchievement(
          progress,
          "old-city",
          achievement.dateRange!,
        );
        break;

      case "inner-circle":
        earned = TIMS_FAVORITES.objectives.every((o) =>
          progress.completedObjectives.includes(o.id),
        );
        break;

      case "shutterbug":
        earned = verifiedPhotoCount >= 5;
        break;

      case "photo-journalist":
        earned = verifiedPhotoCount >= 15;
        break;

      case "city-documentarian":
        earned = verifiedPhotoCount >= 30;
        break;
    }

    if (earned) {
      newAchievements.push(achievement.id);
    }
  }

  return newAchievements;
}

function checkSpeedRunner(
  completedAt: Record<string, string>,
): boolean {
  for (const neighborhood of NEIGHBORHOODS) {
    const objIds = neighborhood.objectives.map((o) => o.id);
    const timestamps = objIds
      .map((id) => completedAt[id])
      .filter(Boolean)
      .map((ts) => new Date(ts).getTime());

    if (timestamps.length === neighborhood.objectives.length) {
      const earliest = Math.min(...timestamps);
      const latest = Math.max(...timestamps);
      const threeHours = 3 * 60 * 60 * 1000;
      if (latest - earliest <= threeHours) return true;
    }
  }
  return false;
}

function checkNeighborhoodsInDay(
  completedAt: Record<string, string>,
  count: number,
): boolean {
  // Group neighborhood completions by day
  const completionDays: Record<string, Set<string>> = {};

  for (const neighborhood of NEIGHBORHOODS) {
    const objIds = neighborhood.objectives.map((o) => o.id);
    const timestamps = objIds
      .map((id) => completedAt[id])
      .filter(Boolean);

    if (timestamps.length === neighborhood.objectives.length) {
      // Use the latest timestamp as "completion time"
      const latestTs = timestamps
        .map((ts) => new Date(ts))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const day = latestTs.toISOString().split("T")[0];
      if (!completionDays[day]) completionDays[day] = new Set();
      completionDays[day].add(neighborhood.id);
    }
  }

  return Object.values(completionDays).some((hoods) => hoods.size >= count);
}

function checkEventAchievement(
  progress: QuestProgress,
  neighborhoodId: string,
  dateRange: { start: string; end: string },
): boolean {
  if (!progress.completedNeighborhoods.includes(neighborhoodId)) return false;
  const now = new Date();
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  return now >= start && now <= end;
}

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
