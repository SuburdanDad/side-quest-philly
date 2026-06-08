"use client";

import Link from "next/link";
import { Lock, ChevronRight } from "lucide-react";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { TIMS_FAVORITES, isSecretQuestUnlocked } from "@/lib/data/secret-quests";

export function SecretQuestCTA() {
  const { progress } = useQuestProgress();
  const unlocked = isSecretQuestUnlocked(progress.completedNeighborhoods);
  const done = TIMS_FAVORITES.objectives.filter((o) =>
    progress.completedObjectives.includes(o.id),
  ).length;
  const total = TIMS_FAVORITES.objectives.length;
  const isComplete = done === total && total > 0;

  return (
    <section>
      <Link href="/quest/tims-favorites" className="block group">
        <div
          className={`relative rounded-xl overflow-hidden p-4 transition-all ${
            unlocked
              ? "bg-gradient-to-br from-[#0F1D36] to-[#1a2a44] text-white group-hover:shadow-lg group-hover:shadow-[#C9A84C]/10"
              : "bg-muted/50 border border-dashed border-muted-foreground/20 group-hover:border-muted-foreground/30"
          }`}
        >
          {/* Gold shimmer bar for unlocked state */}
          {unlocked && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent" />
          )}

          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${
                unlocked
                  ? "bg-[#C9A84C]/20"
                  : "bg-muted-foreground/10"
              }`}
            >
              {unlocked ? (
                <span className="text-xl">🤫</span>
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {unlocked ? (
                <>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-sm uppercase tracking-wide">
                      {TIMS_FAVORITES.name}
                    </p>
                    <span className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/25">
                      Secret
                    </span>
                    {isComplete && (
                      <span className="text-[9px] text-[#C9A84C] font-bold uppercase tracking-wide">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    {done}/{total} &middot; {TIMS_FAVORITES.tagline}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-black text-sm uppercase tracking-wide text-muted-foreground/70">
                    Secret Quest
                  </p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                    {TIMS_FAVORITES.unlockLabel} &middot;{" "}
                    {progress.completedNeighborhoods.length}/
                    {TIMS_FAVORITES.unlockRequirement}
                  </p>
                </>
              )}
            </div>
            <ChevronRight
              className={`h-4 w-4 transition-colors ${
                unlocked
                  ? "text-[#C9A84C]/60 group-hover:text-[#C9A84C]"
                  : "text-muted-foreground/30"
              }`}
            />
          </div>
        </div>
      </Link>
    </section>
  );
}
