export type AchievementRarity = "common" | "rare" | "legendary";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  rarity: AchievementRarity;
  icon: string;
  dateRange?: { start: string; end: string };
};

export type Level = {
  name: string;
  minXP: number;
  emoji: string;
};

export type GamificationState = {
  xp: number;
  achievements: string[];
  achievementTimestamps: Record<string, string>;
  objectiveCompletedAt: Record<string, string>;
};
