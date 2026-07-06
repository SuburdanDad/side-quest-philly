"use client";

import { useEffect } from "react";
import { captureSrc, trackEvent, once, dayKey } from "@/lib/analytics";

/**
 * Captures the first-touch ?src= on any landing page and fires
 * session_start at most once per day — the "who visited" backbone.
 * Renders nothing.
 */
export function AnalyticsBoot() {
  useEffect(() => {
    captureSrc();
    if (once(`session_${dayKey(new Date())}`, "forever")) {
      trackEvent("session_start", {
        referrer: document.referrer || undefined,
      });
    }
  }, []);
  return null;
}
