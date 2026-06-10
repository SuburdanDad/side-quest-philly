"use client";

import Link from "next/link";
import { ArrowLeft, Share2, Trophy, BadgeCheck } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { SiteFooter } from "@/components/site-footer";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { useGamification } from "@/lib/hooks/use-gamification";
import { usePhotoStorage } from "@/lib/hooks/use-photo-storage";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { ALL_OBJECTIVES } from "@/lib/data/all-objectives";
import { LevelBadge } from "@/components/gamification/level-badge";
import { PassportGrid } from "@/components/gamification/passport-grid";
import { AchievementList } from "@/components/gamification/achievement-card";
import { calculateTotalXP } from "@/lib/gamification/xp";

export default function PassportPage() {
  const { progress, getOverallProgress } = useQuestProgress();
  const { gamification } = useGamification();
  const { verifiedCount } = usePhotoStorage();
  const overall = getOverallProgress();

  const xp = calculateTotalXP(
    progress.completedObjectives,
    ALL_OBJECTIVES,
    verifiedCount,
  );

  const handleShare = async () => {
    trackEvent("share");
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
    const shareUrl = `https://side-quest-philly.vercel.app/passport?${ogParams.toString()}`;

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
              <h1 className="font-heading text-3xl font-normal italic tracking-tight">
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
          <section className="bg-card border rounded-xl p-6 text-center animate-content-enter">
            <p className="text-4xl mb-3">🗺️</p>
            <h2 className="font-heading text-xl font-normal italic mb-1">
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
            <section className="bg-card border rounded-xl p-5 animate-content-enter">
              <LevelBadge xp={xp} size="lg" />
              <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t text-center">
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
                  <p className="text-lg font-black text-[#C9A84C] flex items-center justify-center gap-0.5">
                    <BadgeCheck className="h-4 w-4" />
                    {verifiedCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    Verified
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black">
                    {gamification.achievements.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    Awards
                  </p>
                </div>
              </div>
            </section>

            {/* Stamp grid */}
            <section className="animate-content-enter stagger-1">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-xl font-normal italic">
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

            {/* Share + leaderboard */}
            <div className="space-y-2.5">
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0F1D36] text-white py-3 font-bold text-sm hover:bg-[#0F1D36]/90 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                Share Your Passport
              </button>
              <Link
                href="/leaderboard"
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#C9A84C]/40 text-[#0F1D36] py-3 font-bold text-sm hover:bg-[#C9A84C]/10 transition-colors"
              >
                <Trophy className="h-4 w-4 text-[#C9A84C]" />
                View the Leaderboard
              </Link>
            </div>

            {/* Achievements */}
            <section className="animate-content-enter stagger-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-xl font-normal italic">
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

        <SiteFooter />
      </div>
    </main>
  );
}
