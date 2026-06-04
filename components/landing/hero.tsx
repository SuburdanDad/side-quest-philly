"use client";

import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  const { getOverallProgress } = useQuestProgress();
  const { done, total } = getOverallProgress();
  const { user, signOut } = useAuth();

  return (
    <section className="relative overflow-hidden bg-[#004C54] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,rgba(232,24,40,0.15),transparent_50%),radial-gradient(circle_at_70%_20%,rgba(0,107,182,0.15),transparent_50%)]" />
      <div className="absolute top-4 right-4 z-10">
        {user ? (
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
          >
            <User className="h-3.5 w-3.5" />
            {user.email?.split("@")[0]}
            <LogOut className="h-3 w-3" />
          </button>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
          >
            <User className="h-3.5 w-3.5" />
            Sign in to save progress
          </Link>
        )}
      </div>
      <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-24 text-center">
        <p className="text-sm font-medium tracking-widest uppercase text-white/70 mb-3">
          Summer 2026
        </p>
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-4">
          Side Quest
          <span className="block text-[#E8B931]">Philadelphia</span>
        </h1>
        <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-8">
          Explore Philly&apos;s best neighborhoods through scavenger hunts.
          Check off objectives, unlock stamps, and prove you really did this
          city right.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Badge
            variant="secondary"
            className="bg-white/15 text-white border-white/20 hover:bg-white/20 text-sm px-4 py-1.5"
          >
            ⚽ FIFA World Cup
          </Badge>
          <Badge
            variant="secondary"
            className="bg-white/15 text-white border-white/20 hover:bg-white/20 text-sm px-4 py-1.5"
          >
            ⚾ MLB All-Star Game
          </Badge>
          {done > 0 && (
            <Badge
              variant="secondary"
              className="bg-[#E8B931]/20 text-[#E8B931] border-[#E8B931]/30 text-sm px-4 py-1.5"
            >
              {done}/{total} completed
            </Badge>
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
