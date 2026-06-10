"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

type FunnelStats = {
  totals: Record<string, number>;
  unique_visitors: number;
  signups: number;
  starts_by_src: { src: string; count: number }[];
  daily_starts: { day: string; count: number }[];
  verification: { verified: number; rejected: number };
  feedback_count: number;
};

type FeedbackRow = {
  id: number;
  message: string;
  email: string | null;
  created_at: string;
};

export default function FunnelPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<FunnelStats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setState("denied");
      return;
    }
    setState("loading");
    const [statsRes, fbRes] = await Promise.all([
      supabase.rpc("get_funnel_stats"),
      supabase.rpc("get_recent_feedback", { limit_count: 50 }),
    ]);
    if (statsRes.error) {
      setState("denied");
      return;
    }
    setStats(statsRes.data as FunnelStats);
    setFeedback((fbRes.data ?? []) as FeedbackRow[]);
    setState("ready");
  }, []);

  useEffect(() => {
    if (!authLoading && user) load();
    if (!authLoading && !user) setState("denied");
  }, [authLoading, user, load]);

  const totals = stats?.totals ?? {};
  const verifyTotal =
    (stats?.verification.verified ?? 0) + (stats?.verification.rejected ?? 0);
  const verifyRate =
    verifyTotal > 0
      ? Math.round(((stats?.verification.verified ?? 0) / verifyTotal) * 100)
      : null;

  return (
    <main className="flex-1">
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
              <h1 className="font-heading text-3xl italic tracking-tight">
                The Funnel
              </h1>
              <p className="text-[11px] text-white/50 mt-0.5 font-bold uppercase tracking-wider">
                Launch dashboard · admin only
              </p>
            </div>
            <button
              onClick={load}
              aria-label="Refresh"
              className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="h-4 w-4 text-[#C9A84C]" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
        {state === "loading" ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : state === "denied" ? (
          <section className="bg-card border rounded-xl p-8 text-center">
            <p className="text-4xl mb-3">🔒</p>
            <p className="text-sm text-muted-foreground">
              This page is for the quest keepers.
              {!user && (
                <>
                  {" "}
                  <Link
                    href="/login?next=/admin/funnel"
                    className="font-bold text-[#C9A84C]"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </section>
        ) : (
          <>
            {/* Stat cards */}
            <section className="grid grid-cols-3 gap-2">
              {[
                { label: "Visitors", value: stats?.unique_visitors ?? 0 },
                { label: "Quest starts", value: totals.quest_start ?? 0 },
                { label: "Completes", value: totals.objective_complete ?? 0 },
                {
                  label: "Verified",
                  value: stats?.verification.verified ?? 0,
                  gold: true,
                },
                {
                  label: "Verify rate",
                  value: verifyRate === null ? "—" : `${verifyRate}%`,
                  gold: true,
                },
                { label: "Shares", value: totals.share ?? 0 },
                { label: "Signups", value: stats?.signups ?? 0 },
                { label: "Feedback", value: stats?.feedback_count ?? 0 },
                { label: "QR scans", value: totals.quest_start ? (stats?.starts_by_src ?? []).filter(s => s.src.startsWith("qr-")).reduce((a, s) => a + s.count, 0) : 0 },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border bg-card p-3 text-center"
                >
                  <p
                    className={`font-mono tabular-nums text-xl font-black ${card.gold ? "text-[#C9A84C]" : ""}`}
                  >
                    {card.value}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </p>
                </div>
              ))}
            </section>

            {/* Starts by source */}
            <section className="bg-card border rounded-xl p-4">
              <h2 className="text-xs font-black uppercase tracking-wide text-muted-foreground mb-3">
                Quest starts by source
              </h2>
              {(stats?.starts_by_src ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No starts yet — hang the posters!
                </p>
              ) : (
                <div className="space-y-1.5">
                  {(stats?.starts_by_src ?? []).map((row) => (
                    <div
                      key={row.src}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium truncate">{row.src}</span>
                      <span className="font-mono tabular-nums font-bold">
                        {row.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Daily starts */}
            <section className="bg-card border rounded-xl p-4">
              <h2 className="text-xs font-black uppercase tracking-wide text-muted-foreground mb-3">
                Daily quest starts · last 14 days
              </h2>
              {(stats?.daily_starts ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <div className="flex items-end gap-1 h-20">
                  {(stats?.daily_starts ?? []).map((d) => {
                    const max = Math.max(
                      ...(stats?.daily_starts ?? []).map((x) => x.count),
                      1,
                    );
                    return (
                      <div
                        key={d.day}
                        title={`${d.day}: ${d.count}`}
                        className="flex-1 rounded-t bg-[#C9A84C]"
                        style={{
                          height: `${Math.max((d.count / max) * 100, 6)}%`,
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {/* Feedback */}
            <section className="bg-card border rounded-xl p-4">
              <h2 className="text-xs font-black uppercase tracking-wide text-muted-foreground mb-3">
                What users think · {feedback.length} recent
              </h2>
              {feedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No feedback yet. It&apos;ll show up here the moment someone
                  taps &ldquo;Tell us what you think.&rdquo;
                </p>
              ) : (
                <div className="space-y-3">
                  {feedback.map((f) => (
                    <div key={f.id} className="border-b pb-2 last:border-0">
                      <p className="text-sm leading-snug">{f.message}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {f.email ? `${f.email} · ` : ""}
                        {new Date(f.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
