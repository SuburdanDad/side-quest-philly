"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Safety net for magic-link codes that land outside /auth/callback
 * (e.g. Supabase falling back to its Site URL and appending ?code=
 * to whatever page it points at). Exchanges the code for a session
 * in-place and cleans the URL. Harmless when no code is present.
 */
export function AuthCodeCatcher() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const supabase = createClient();
    if (!supabase) return;

    supabase.auth
      .exchangeCodeForSession(code)
      .catch(() => {})
      .finally(() => {
        params.delete("code");
        const query = params.toString();
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (query ? `?${query}` : ""),
        );
      });
  }, []);

  return null;
}
