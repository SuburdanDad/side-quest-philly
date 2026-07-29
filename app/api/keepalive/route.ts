import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Daily cron ping (vercel.json) that makes one real database request
 * so Supabase's free tier never pauses the project for inactivity —
 * keeps the leaderboard and admin dashboards alive for portfolio
 * visitors indefinitely.
 */
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ ok: false, reason: "unconfigured" });
    }
    const supabase = createSupabaseClient(url, key);
    const { data, error } = await supabase.rpc("keepalive");
    if (error) throw error;
    return NextResponse.json({ ok: true, ts: data });
  } catch (error) {
    console.error(
      "[keepalive] ping failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
