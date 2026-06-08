"use client";

import Link from "next/link";
import { User, LogOut, Star } from "lucide-react";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { useAuth } from "@/components/auth/auth-provider";

export function Hero() {
  const { getOverallProgress } = useQuestProgress();
  const { done, total } = getOverallProgress();
  const { user, signOut } = useAuth();

  return (
    <section className="relative overflow-hidden text-white">
      {/* Bright Philly skyline - daytime/golden hour shot */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/hero-skyline.jpg')",
        }}
      />
      {/* Lighter overlay - see the city! */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F1D36]/60 via-[#0F1D36]/50 to-[#0F1D36]/70" />

      {/* Stars & stripes top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex h-3">
        <div className="w-[15%] bg-[#3C3B6E] flex items-center justify-center gap-[3px]">
          <span className="text-white text-[5px] leading-none">★</span>
          <span className="text-white text-[5px] leading-none">★</span>
          <span className="text-white text-[5px] leading-none">★</span>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-[#B22234]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#B22234]" />
        </div>
      </div>

      {/* Auth corner */}
      <div className="absolute top-4 right-3 z-10">
        {user ? (
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white transition-colors px-3 py-2.5 min-h-[44px]"
          >
            <User className="h-3.5 w-3.5" />
            {user.email?.split("@")[0]}
            <LogOut className="h-3 w-3" />
          </button>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white transition-colors px-3 py-2.5 min-h-[44px]"
          >
            <User className="h-3.5 w-3.5" />
            Sign in
          </Link>
        )}
      </div>

      <div className="relative mx-auto max-w-lg px-5 pt-14 sm:pt-20 pb-8 text-center flex flex-col items-center">
        {/* Stars row */}
        <div className="flex items-center gap-1.5 mb-3">
          {[...Array(7)].map((_, i) => (
            <Star
              key={i}
              className={`${i === 3 ? "h-4 w-4" : "h-3 w-3"} text-[#C9A84C] fill-[#C9A84C]`}
            />
          ))}
        </div>

        {/* Main title */}
        <h1 className="font-heading text-[48px] sm:text-7xl font-normal italic tracking-tight leading-[0.9] mb-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
          Side Quest
        </h1>
        <p className="font-heading text-[42px] sm:text-6xl font-normal italic tracking-tight leading-[0.9] text-[#C9A84C] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] mb-4">
          Philadelphia
        </p>

        <p className="text-sm text-white/80 max-w-[300px] mx-auto mb-5 leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
          The city that started it all. 9 neighborhoods.
          45 objectives. Your summer adventure.
        </p>

        {/* Event cards - America 250 in the middle */}
        <div className="flex gap-2 mb-4 w-full max-w-[340px]">
          <div className="flex-1 bg-black/30 backdrop-blur-md border border-white/15 rounded-xl p-2.5 text-center">
            <span className="text-2xl block mb-0.5">⚽</span>
            <p className="text-[10px] font-bold uppercase tracking-wide">
              FIFA
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide">
              World Cup
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">Jun 11 - Jul 19</p>
          </div>
          <div className="flex-1 bg-[#C9A84C]/25 backdrop-blur-md border border-[#C9A84C]/40 rounded-xl p-2.5 text-center">
            <span className="text-2xl block mb-0.5">🔔</span>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C]">
              America
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C]">
              250
            </p>
            <p className="text-[10px] text-[#C9A84C]/60 mt-0.5">All Summer</p>
          </div>
          <div className="flex-1 bg-black/30 backdrop-blur-md border border-white/15 rounded-xl p-2.5 text-center">
            <span className="text-2xl block mb-0.5">⚾</span>
            <p className="text-[10px] font-bold uppercase tracking-wide">
              MLB
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide">
              All-Star
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">Jul 13 - 15</p>
          </div>
        </div>

        {/* 250th banner */}
        <div className="relative mb-3">
          <div className="bg-[#B22234] text-white px-5 py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase rounded-sm">
            Celebrating 250 Years of America
          </div>
        </div>

        {done > 0 && (
          <div className="bg-[#C9A84C]/20 border border-[#C9A84C]/30 rounded-full px-4 py-1">
            <span className="text-[11px] font-bold text-[#C9A84C]">
              {done}/{total} completed
            </span>
          </div>
        )}
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
