import Link from "next/link";
import { Trophy, Stamp, Medal } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/landing/hero";
import { NeighborhoodGrid } from "@/components/landing/neighborhood-grid";
import { SecretQuestCTA } from "@/components/landing/secret-quest-cta";
import { ULTIMATE_QUEST_IDS } from "@/lib/data/quests";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />

      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* How it works - bold numbered steps */}
        <section className="bg-card border rounded-xl p-4 animate-content-enter">
          <h2 className="font-heading text-xl font-normal italic mb-3">
            How It Works
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="w-8 h-8 rounded-full bg-[#B22234] text-white flex items-center justify-center text-sm font-black mx-auto mb-1.5">
                1
              </div>
              <p className="text-[11px] font-bold">Pick a hood</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                9 neighborhoods, 5 stops each
              </p>
            </div>
            <div>
              <div className="w-8 h-8 rounded-full bg-[#3C3B6E] text-white flex items-center justify-center text-sm font-black mx-auto mb-1.5">
                2
              </div>
              <p className="text-[11px] font-bold">Walk and explore</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                History, culture, fun, then food
              </p>
            </div>
            <div>
              <div className="w-8 h-8 rounded-full bg-[#C9A84C] text-white flex items-center justify-center text-sm font-black mx-auto mb-1.5">
                3
              </div>
              <p className="text-[11px] font-bold">Earn your stamp</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Complete all 5, celebrate
              </p>
            </div>
          </div>
        </section>

        {/* Neighborhood quests */}
        <section className="animate-content-enter stagger-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-xl font-normal italic">
              Choose Your Quest
            </h2>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              {NEIGHBORHOODS.length} neighborhoods
            </span>
          </div>
          <NeighborhoodGrid />
        </section>

        {/* Secret quest CTA */}
        <SecretQuestCTA />

        {/* Passport CTA */}
        <section className="animate-content-enter stagger-3">
          <Link href="/passport" className="block group">
            <div className="relative rounded-xl overflow-hidden bg-[#0F1D36] p-4 text-white group-hover:shadow-lg transition-all">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A84C] via-[#B22234] to-[#C9A84C]" />
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                  <Stamp className="h-5 w-5 text-[#C9A84C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm uppercase tracking-wide">
                    Your Passport
                  </p>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    XP, levels, stamps, and hidden achievements. Track your journey.
                  </p>
                </div>
                <span className="text-[#C9A84C] text-lg font-bold">&rsaquo;</span>
              </div>
            </div>
          </Link>
        </section>

        {/* Leaderboard CTA */}
        <section className="animate-content-enter stagger-3">
          <Link href="/leaderboard" className="block group">
            <div className="relative rounded-xl overflow-hidden bg-[#0F1D36] p-4 text-white group-hover:shadow-lg transition-all">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#3C3B6E] via-[#C9A84C] to-[#B22234]" />
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                  <Medal className="h-5 w-5 text-[#C9A84C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm uppercase tracking-wide">
                    City Legends
                  </p>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    The leaderboard. AI-verified photos earn bonus XP. Where do
                    you rank?
                  </p>
                </div>
                <span className="text-[#C9A84C] text-lg font-bold">&rsaquo;</span>
              </div>
            </div>
          </Link>
        </section>

        {/* Ultimate quest CTA */}
        <section className="animate-content-enter stagger-4">
          <Link href="/ultimate" className="block group">
            <div className="relative rounded-xl overflow-hidden bg-[#0F1D36] p-4 text-white group-hover:shadow-lg transition-all">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B22234] via-[#C9A84C] to-[#3C3B6E]" />
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-[#C9A84C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm uppercase tracking-wide">
                    The Ultimate Quest
                  </p>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    {ULTIMATE_QUEST_IDS.length} objectives across the entire
                    city. Legendary status.
                  </p>
                </div>
                <span className="text-[#C9A84C] text-lg font-bold">&rsaquo;</span>
              </div>
            </div>
          </Link>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
