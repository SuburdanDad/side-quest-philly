"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js (the offline app shell) in production builds only, so
 * `next dev` never serves stale pages. updateViaCache "none": the browser always
 * re-checks sw.js itself against the server.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // No service worker (private mode, old browser): the app still works online.
    });
  }, []);
  return null;
}
