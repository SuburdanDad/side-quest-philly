"use client";

import Link from "next/link";
import { ArrowLeft, Share2 } from "lucide-react";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { useGamification } from "@/lib/hooks/use-gamification";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { LevelBadge } from "@/components/gamification/level-badge";
import { PassportGrid } from "@/components/gamification/passport-grid";
import { AchievementList } from "@/components/gamification/achievement-card";
import { calculateXP } from "@/lib/gamification/xp";

export default function PassportPage() {
  const { progress, getOverallProgress } = useQuestProgress();
  const { gamification } = useGamification();
  const overall = getOverallProgress();

  const allObjectives = NEIGHBORHOODS.flatMap((n) =>
    n.objectives.map((o) => ({ id: o.id, category: o.category })),
  );
  const xp = calculateXP(progress.completedObjectives, allObjectives);

  const handleShare = async () => {
    const completed = progress.completedNeighborhoods.length;
    const total = NEIGHBORHOODS.length;
    const grid = NEIGHBORHOODS.map((n) =>
      progress.completedNeighborhoods.includes(n.id) ? n.emoji : "⬜",
    );

    // Build share URL with OG params so the link unfurls with a passport image
    const ogParams = new URLSearchParams({
      xp: String(xp),
      stamps: progress.completedNeighborhoods.join(","),
      a: String(gamification.achievements.length),
      obj: String(progress.completedObjectives.length),
    });
    const shareUrl = `https://sidequestphilly.com/passport?${ogParams.toString()}`;

    const text = [
      `🗺️ Side Quest Philadelphia`,
      ``,
      `${grid.slice(0, 3).join("")}`,
      `${grid.slice(3, 6).join("")}`,
      `${grid.slice(6, 9).join("")}`,
      ``,
      `${completed}/${total} neighborhoods | ${xp} XP`,
      ``,
      shareUrl,
    ].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ text, url: shareUrl });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const isEmpty = progress.completedObjectives.length === 0;

  return (
    <main className="flex-1">
      {/* Header */}
      <div className="bg-[#0F1D36] text-white">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B22234] via-[#C9A84C] to-[#3C3B6E]" />
        <div className="mx-auto max-w-lg px-4 pt-6 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wide">
                Your Passport
              </h1>
              <p className="text-[11px] text-white/50 mt-0.5 font-bold uppercase tracking-wider">
                Side Quest Philadelphia
              </p>
            </div>
            <LevelBadge xp={xp} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {isEmpty ? (
          /* Empty state */
          <section className="bg-card border rounded-xl p-6 text-center">
            <p className="text-4xl mb-3">🗺️</p>
            <h2 className="font-black text-lg uppercase tracking-wide mb-1">
              Your adventure awaits
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Complete all 5 objectives in a neighborhood to earn your stamp.
              Collect all 9 to become a Philly Native.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-[#0F1D36] text-white px-6 py-2.5 text-sm font-bold hover:bg-[#0F1D36]/90 transition-colors"
            >
              Start Your First Quest
            </Link>
          </section>
        ) : (
          <>
            {/* XP + Level */}
            <section className="bg-card border rounded-xl p-5">
              <LevelBadge xp={xp} size="lg" />
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t text-center">
                <div>
                  <p className="text-lg font-black">{overall.done}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    Objectives
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black">
                    {progress.completedNeighborhoods.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    Stamps
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black">
                    {gamification.achievements.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    Achievements
                  </p>
                </div>
              </div>
            </section>

            {/* Stamp grid */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black uppercase tracking-wide">
                  Stamps
                </h2>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  {progress.completedNeighborhoods.length}/{NEIGHBORHOODS.length}
                </span>
              </div>
              <div className="bg-card border rounded-xl p-3">
                <PassportGrid />
              </div>
            </section>

            {/* Share button */}
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0F1D36] text-white py-3 font-bold text-sm hover:bg-[#0F1D36]/90 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              Share Your Passport
            </button>

            {/* Achievements */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black uppercase tracking-wide">
                  Achievements
                </h2>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  {gamification.achievements.length} unlocked
                </span>
              </div>
              <div className="bg-card border rounded-xl p-3">
                <AchievementList earnedIds={gamification.achievements} />
              </div>
            </section>
          </>
        )}

        <footer className="text-center text-[10px] text-muted-foreground py-6 border-t space-y-0.5">
          <p className="font-bold uppercase tracking-widest">
            Side Quest Philadelphia
          </p>
          <p>Summer 2026 ... Celebrating 250 years of America</p>
        </footer>
      </div>
    </main>
  );
}
