"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * First-party analytics: anonymous session id + first-touch source,
 * events written through the validated log_event() Postgres function.
 * Everything here is fire-and-forget — analytics must never break play.
 */

const ANON_KEY = "sqp_anon_id";
const SRC_KEY = "sqp_src";

export type AnalyticsEvent =
  | "quest_start"
  | "objective_complete"
  | "share"
  | "signup";

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
  opts: { questId?: string; objectiveId?: string } = {},
) {
  if (typeof window === "undefined") return;
  const anonId = getAnonId();
  if (!anonId) return;
  const supabase = createClient();
  if (!supabase) return;

  supabase
    .rpc("log_event", {
      p_anon_id: anonId,
      p_event: event,
      p_src: getSrc(),
      p_quest_id: opts.questId ?? null,
      p_objective_id: opts.objectiveId ?? null,
    })
    .then(
      () => {},
      () => {},
    );
}
