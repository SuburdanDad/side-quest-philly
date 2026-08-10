"use client";

import Link from "next/link";
import { ArrowLeft, BadgeCheck, Stamp, Trophy } from "lucide-react";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { usePhotoStorage } from "@/lib/hooks/use-photo-storage";
import { ALL_OBJECTIVES } from "@/lib/data/all-objectives";
import { calculateTotalXP, getLevel } from "@/lib/gamification/xp";
import { SiteFooter } from "@/components/site-footer";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Portfolio mode: the live, account-backed board is retired. You now
 * compete against the city's all-time legends — beat Ben Franklin and
 * the #1 spot is yours. All stats come straight from localStorage.
 */
const LEGENDS = [
  { name: "Ben F.", xp: 788, stamps: 9, verified: 31 },
  { name: "Betsy R.", xp: 640, stamps: 8, verified: 26 },
  { name: "Rocky B.", xp: 515, stamps: 7, verified: 19 },
  { name: "Grace K.", xp: 430, stamps: 6, verified: 15 },
  { name: "Will S.", xp: 320, stamps: 4, verified: 11 },
];

type Row = {
  name: string;
  xp: number;
  stamps: number;
  verified: number;
  isMe: boolean;
};

export default function LeaderboardPage() {
  const { progress } = useQuestProgress();
  const { verifiedCount } = usePhotoStorage();

  const myXP = calculateTotalXP(
    progress.completedObjectives,
    ALL_OBJECTIVES,
    verifiedCount,
  );

  const me: Row = {
    name: "You",
    xp: myXP,
    stamps: progress.completedNeighborhoods.length,
    verified: verifiedCount,
    isMe: true,
  };

  const rows: Row[] = [...LEGENDS.map((l) => ({ ...l, isMe: false })), me].sort(
    (a, b) => b.xp - a.xp || b.verified - a.verified,
  );
  const myRank = rows.findIndex((r) => r.isMe) + 1;
  const level = getLevel(myXP);

  return (
    <main className="flex-1">
      {/* Header */}
      <div className="bg-[#0F1D36] text-white relative">
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
                City Legends
              </h1>
              <p className="text-[11px] text-white/50 mt-0.5 font-bold uppercase tracking-wider">
                Can you out-quest Ben Franklin?
              </p>
            </div>
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-[#C9A84C]" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
        {/* Your rank card */}
        <section className="rounded-xl border-2 border-[#C9A84C]/50 bg-[#C9A84C]/5 p-4 animate-content-enter">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Your Rank
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono tabular-nums text-2xl font-black text-[#0F1D36]">
                  #{myRank}
                </span>
                <span className="font-semibold text-sm">
                  {myRank === 1 ? "New City Legend" : "Challenger"}
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-mono tabular-nums text-xl font-black text-[#C9A84C]">
                {myXP} XP
              </p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase">
                {level.emoji} {level.name}
              </p>
            </div>
          </div>
        </section>

        {/* The board */}
        <section className="bg-card border rounded-xl p-3 space-y-2 animate-content-enter stagger-1">
          {rows.map((row, i) => (
            <div
              key={row.name}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                row.isMe
                  ? "border-[#C9A84C]/60 bg-[#C9A84C]/10"
                  : "bg-background"
              }`}
            >
              <span className="w-7 text-center font-mono tabular-nums text-sm font-bold flex-shrink-0">
                {i < 3 ? MEDALS[i] : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {row.name}
                  {row.isMe && (
                    <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider text-[#C9A84C]">
                      That&apos;s you
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-2">
                  <span className="inline-flex items-center gap-0.5">
                    <Stamp className="h-2.5 w-2.5" />
                    {row.stamps}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[#C9A84C]">
                    <BadgeCheck className="h-2.5 w-2.5" />
                    {row.verified} verified
                  </span>
                </p>
              </div>
              <span className="font-mono tabular-nums text-sm font-black text-[#C9A84C] flex-shrink-0">
                {row.xp} XP
              </span>
            </div>
          ))}
        </section>

        <p className="text-center text-[11px] text-muted-foreground">
          XP = objectives completed + 5 bonus XP per AI-verified photo. Legends
          hold career totals — beat them all and the city is yours.
        </p>

        <SiteFooter />
      </div>
    </main>
  );
}
