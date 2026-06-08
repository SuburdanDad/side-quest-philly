"use client";

import { getLevel, getNextLevel, getLevelProgress } from "@/lib/gamification/xp";

type LevelBadgeProps = {
  xp: number;
  size?: "sm" | "lg";
};

export function LevelBadge({ xp, size = "sm" }: LevelBadgeProps) {
  const level = getLevel(xp);
  const next = getNextLevel(xp);
  const progress = getLevelProgress(xp);

  if (size === "lg") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-4xl">{level.emoji}</div>
        <div className="text-center">
          <p className="font-black text-lg uppercase tracking-wide">
            {level.name}
          </p>
          <p className="text-sm text-muted-foreground font-bold">
            {xp} XP
          </p>
        </div>
        {next && (
          <div className="w-full max-w-[200px]">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A84C] rounded-full transition-all duration-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {next.minXP - xp} XP to {next.name}
            </p>
          </div>
        )}
        {!next && (
          <p className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wide">
            Max Level
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-lg">{level.emoji}</span>
      <div>
        <p className="text-[11px] font-bold leading-tight">{level.name}</p>
        <p className="text-[10px] text-muted-foreground">{xp} XP</p>
      </div>
    </div>
  );
}
