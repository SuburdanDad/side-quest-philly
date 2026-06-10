"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Stamp,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { getLevel } from "@/lib/gamification/xp";

type LeaderboardRow = {
  rank: number;
  display_name: string;
  xp: number;
  stamps: number;
  objectives_done: number;
  verified_photos: number;
  is_me: boolean;
};

const MEDALS = ["🥇", "🥈", "🥉"];

// Placeholder rows behind the guest lock — famous Philadelphians.
const TEASER_ROWS = [
  { name: "Ben F.", xp: 788, stamps: 9 },
  { name: "Betsy R.", xp: 640, stamps: 8 },
  { name: "Rocky B.", xp: 515, stamps: 7 },
  { name: "Grace K.", xp: 430, stamps: 6 },
  { name: "Will S.", xp: 320, stamps: 4 },
];

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoadError(true);
      return;
    }
    const { data, error } = await supabase.rpc("get_leaderboard", {
      limit_count: 50,
    });
    if (error) {
      console.error("[leaderboard] load failed:", error.message);
      setLoadError(true);
      return;
    }
    setRows((data ?? []) as LeaderboardRow[]);
  }, []);

  useEffect(() => {
    if (user) loadLeaderboard();
  }, [user, loadLeaderboard]);

  async function handleSaveName() {
    const trimmed = nameDraft.trim().slice(0, 40);
    if (!trimmed || !user) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: trimmed });
      if (error) console.error("[leaderboard] rename failed:", error.message);
      await loadLeaderboard();
    }
    setSavingName(false);
    setEditingName(false);
  }

  const myRow = rows?.find((r) => r.is_me);

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
                Leaderboard · Summer 2026
              </p>
            </div>
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-[#C9A84C]" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
        {authLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !user ? (
          /* ---- Guest gate: email required for leaderboard access ---- */
          <>
            <section className="relative overflow-hidden rounded-xl border bg-card animate-content-enter">
              {/* Blurred teaser rows */}
              <div className="p-3 space-y-2 blur-[6px] select-none pointer-events-none opacity-70">
                {TEASER_ROWS.map((row, i) => (
                  <div
                    key={row.name}
                    className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
                  >
                    <span className="w-6 text-center font-mono tabular-nums text-sm font-bold">
                      {i < 3 ? MEDALS[i] : i + 1}
                    </span>
                    <span className="flex-1 font-semibold text-sm">
                      {row.name}
                    </span>
                    <span className="font-mono tabular-nums text-sm font-black text-[#C9A84C]">
                      {row.xp} XP
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {row.stamps} 🛂
                    </span>
                  </div>
                ))}
              </div>

              {/* Lock overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-transparent via-background/60 to-background px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-[#0F1D36] flex items-center justify-center shadow-lg">
                  <Lock className="h-5 w-5 text-[#C9A84C]" />
                </div>
                <div>
                  <p className="font-heading text-xl italic">
                    The legends are in here
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sign in with your email to see the rankings and claim your
                    spot.
                  </p>
                </div>
              </div>
            </section>

            <Link
              href="/login?next=/leaderboard"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0F1D36] text-white py-3.5 font-bold text-sm hover:bg-[#0F1D36]/90 transition-colors animate-content-enter stagger-1"
            >
              <Mail className="h-4 w-4" />
              Enter the Leaderboard
            </Link>
            <p className="text-center text-[11px] text-muted-foreground animate-content-enter stagger-2">
              Free · no password · your progress syncs across devices too
            </p>
          </>
        ) : loadError ? (
          <section className="bg-card border rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load the leaderboard. Pull to refresh or try again
              shortly.
            </p>
          </section>
        ) : rows === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <section className="bg-card border rounded-xl p-8 text-center animate-content-enter">
            <p className="text-4xl mb-3">🏆</p>
            <h2 className="font-heading text-xl italic mb-1">
              No legends yet
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Complete objectives and snap verified photos — you could be #1 on
              this board by sundown.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-[#0F1D36] text-white px-6 py-2.5 text-sm font-bold hover:bg-[#0F1D36]/90 transition-colors"
            >
              Start Questing
            </Link>
          </section>
        ) : (
          /* ---- The board ---- */
          <>
            {myRow && (
              <section className="rounded-xl border-2 border-[#C9A84C]/50 bg-[#C9A84C]/5 p-4 animate-content-enter">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Your Rank
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono tabular-nums text-2xl font-black text-[#0F1D36]">
                        #{myRow.rank}
                      </span>
                      {editingName ? (
                        <span className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveName();
                              if (e.key === "Escape") setEditingName(false);
                            }}
                            maxLength={40}
                            className="w-36 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Explorer name"
                          />
                          <button
                            onClick={handleSaveName}
                            disabled={savingName}
                            className="text-xs font-bold text-[#C9A84C]"
                          >
                            {savingName ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setNameDraft(myRow.display_name);
                            setEditingName(true);
                          }}
                          className="inline-flex items-center gap-1.5 font-semibold text-sm hover:text-[#C9A84C] transition-colors"
                        >
                          {myRow.display_name}
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono tabular-nums text-xl font-black text-[#C9A84C]">
                      {myRow.xp} XP
                    </p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">
                      {getLevel(myRow.xp).emoji} {getLevel(myRow.xp).name}
                    </p>
                  </div>
                </div>
              </section>
            )}

            <section className="bg-card border rounded-xl p-3 space-y-2 animate-content-enter stagger-1">
              {rows.map((row) => (
                <div
                  key={`${row.rank}-${row.display_name}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                    row.is_me
                      ? "border-[#C9A84C]/60 bg-[#C9A84C]/10"
                      : "bg-background"
                  }`}
                >
                  <span className="w-7 text-center font-mono tabular-nums text-sm font-bold flex-shrink-0">
                    {row.rank <= 3 ? MEDALS[row.rank - 1] : row.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {row.display_name}
                      {row.is_me && (
                        <span className="ml-1.5 text-[9px] font-black uppercase tracking-wider text-[#C9A84C]">
                          You
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
                        {row.verified_photos} verified
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
              XP = objectives completed + 5 bonus XP per AI-verified photo.
            </p>
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
