"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * First-party analytics: anonymous session id + first-touch source.
 * Events POST to /api/events, which enriches them (country, device)
 * before writing through the validated log_event() Postgres function.
 * Everything here is fire-and-forget — analytics must never break play.
 */

const ANON_KEY = "sqp_anon_id";
const SRC_KEY = "sqp_src";

export type AnalyticsEvent =
  | "session_start"
  | "quest_start"
  | "objective_complete"
  | "share"
  | "signup";

/** YYYY-MM-DD key used to fire session_start at most once per day. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** First touch wins: an already-stored source never gets overwritten. */
export function resolveFirstTouchSrc(
  stored: string | null,
  fromUrl: string | null,
): string | null {
  if (stored && stored.trim()) return stored;
  if (fromUrl && fromUrl.trim()) return fromUrl.trim().slice(0, 64);
  return null;
}

export function getAnonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Call on every page load — records ?src= as the session's first-touch source. */
export function captureSrc() {
  if (typeof window === "undefined") return;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("src");
    const next = resolveFirstTouchSrc(localStorage.getItem(SRC_KEY), fromUrl);
    if (next) localStorage.setItem(SRC_KEY, next);
  } catch {
    // ignore
  }
}

export function getSrc(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SRC_KEY);
  } catch {
    return null;
  }
}

/** Fire an event exactly once per key (session- or forever-scoped). */
export function once(key: string, scope: "session" | "forever" = "session"): boolean {
  if (typeof window === "undefined") return false;
  try {
    const store = scope === "session" ? sessionStorage : localStorage;
    if (store.getItem(`sqp_evt_${key}`)) return false;
    store.setItem(`sqp_evt_${key}`, "1");
    return true;
  } catch {
    return false;
  }
}

export function trackEvent(
  event: AnalyticsEvent,
  opts: { questId?: string; objectiveId?: string; referrer?: string } = {},
) {
  if (typeof window === "undefined") return;
  const anonId = getAnonId();
  if (!anonId) return;

  void (async () => {
    try {
      // Forward the session token (when signed in) so the event row
      // records user_id — this is what links visitors to emails.
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const supabase = createClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      await fetch("/api/events", {
        method: "POST",
        headers,
        // keepalive lets share/complete events survive page navigation
        keepalive: true,
        body: JSON.stringify({
          anonId,
          event,
          src: getSrc(),
          questId: opts.questId,
          objectiveId: opts.objectiveId,
          referrer: opts.referrer,
        }),
      });
    } catch {
      // never break play
    }
  })();
}
