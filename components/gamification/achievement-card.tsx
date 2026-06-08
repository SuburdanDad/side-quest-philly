"use client";

import { ACHIEVEMENTS } from "@/lib/gamification/achievements";
import type { AchievementRarity } from "@/lib/gamification/types";

const RARITY_STYLES: Record<AchievementRarity, string> = {
  common: "border-[#CD7F32]/40 bg-[#CD7F32]/5",
  rare: "border-[#C0C0C0]/40 bg-[#C0C0C0]/5",
  legendary: "border-[#C9A84C]/40 bg-[#C9A84C]/5",
};

const RARITY_LABELS: Record<AchievementRarity, { text: string; color: string }> = {
  common: { text: "Common", color: "text-[#CD7F32]" },
  rare: { text: "Rare", color: "text-[#888]" },
  legendary: { text: "Legendary", color: "text-[#C9A84C]" },
};

type AchievementListProps = {
  earnedIds: string[];
};

export function AchievementList({ earnedIds }: AchievementListProps) {
  const earned = ACHIEVEMENTS.filter((a) => earnedIds.includes(a.id));
  const locked = ACHIEVEMENTS.filter((a) => !earnedIds.includes(a.id));

  if (earned.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-2xl mb-2">🔒</p>
        <p className="text-sm font-bold text-muted-foreground">
          No achievements yet
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Complete objectives to unlock hidden achievements
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {earned.map((a) => {
        const rarity = RARITY_LABELS[a.rarity];
        return (
          <div
            key={a.id}
            className={`flex items-center gap-3 rounded-xl border p-3 ${RARITY_STYLES[a.rarity]}`}
          >
            <span className="text-2xl flex-shrink-0">{a.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-black truncate">{a.name}</p>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${rarity.color}`}>
                  {rarity.text}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {a.description}
              </p>
            </div>
          </div>
        );
      })}

      {locked.length > 0 && (
        <p className="text-[11px] text-muted-foreground text-center pt-2">
          {locked.length} more achievement{locked.length !== 1 ? "s" : ""} to discover...
        </p>
      )}
    </div>
  );
}
