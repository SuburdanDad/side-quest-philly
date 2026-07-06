"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

type VisitorRow = {
  anon_id: string;
  first_seen: string;
  last_seen: string;
  first_src: string | null;
  country: string | null;
  device: string | null;
  active_days: number;
  events: number;
  quest_starts: number;
  completes: number;
  verified: number;
  shares: number;
  email: string | null;
};

function csvEscape(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: VisitorRow[]): string {
  const header = [
    "anon_id",
    "email",
    "first_seen",
    "last_seen",
    "first_src",
    "country",
    "device",
    "active_days",
    "events",
    "quest_starts",
    "completes",
    "verified",
    "shares",
  ];
  const lines = rows.map((r) =>
    [
      r.anon_id,
      r.email,
      r.first_seen,
      r.last_seen,
      r.first_src,
      r.country,
      r.device,
      r.active_days,
      r.events,
      r.quest_starts,
      r.completes,
      r.verified,
      r.shares,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function VisitorsPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<VisitorRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setState("denied");
      return;
    }
    setState("loading");
    const { data, error } = await supabase.rpc("get_visitors", {
      limit_count: 500,
    });
    if (error) {
      setState("denied");
      return;
    }
    setRows((data ?? []) as VisitorRow[]);
    setState("ready");
  }, []);

  useEffect(() => {
    if (!authLoading && user) load();
    if (!authLoading && !user) setState("denied");
  }, [authLoading, user, load]);

  function handleExport() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `side-quest-visitors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="flex-1">
      <div className="bg-[#0F1D36] text-white relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B22234] via-[#C9A84C] to-[#3C3B6E]" />
        <div className="mx-auto max-w-lg px-4 pt-6 pb-6">
          <Link
            href="/admin/funnel"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> The Funnel
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading text-3xl italic tracking-tight">
                Visitors
              </h1>
              <p className="text-[11px] text-white/50 mt-0.5 font-bold uppercase tracking-wider">
                Every explorer, all history · admin only
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
                    href="/login?next=/admin/visitors"
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
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {rows.length} visitors (most recent first)
              </p>
              <button
                onClick={handleExport}
                disabled={rows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>

            {rows.length === 0 ? (
              <section className="bg-card border rounded-xl p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No visitors recorded yet — hang the posters!
                </p>
              </section>
            ) : (
              <section className="space-y-2">
                {rows.map((v) => (
                  <div
                    key={v.anon_id}
                    className="bg-card border rounded-xl p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate">
                        {v.email ?? (
                          <span className="font-mono text-muted-foreground">
                            {v.anon_id.slice(0, 8)}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-shrink-0">
                        {[v.country, v.device, v.first_src]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                      {[
                        { label: "Days", value: v.active_days },
                        { label: "Starts", value: v.quest_starts },
                        { label: "Done", value: v.completes },
                        { label: "Verified", value: v.verified, gold: true },
                        { label: "Shares", value: v.shares },
                      ].map((s) => (
                        <div key={s.label}>
                          <p
                            className={`font-mono tabular-nums text-sm font-black ${s.gold ? "text-[#C9A84C]" : ""}`}
                          >
                            {s.value}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            {s.label}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      First {new Date(v.first_seen).toLocaleDateString()} ·
                      last {new Date(v.last_seen).toLocaleString()}
                    </p>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
