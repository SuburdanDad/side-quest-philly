import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { classifyDevice } from "@/lib/device";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CLIENT_EVENTS = new Set([
  "session_start",
  "quest_start",
  "objective_complete",
  "share",
  "signup",
]);

/**
 * Event ingestion with server-side enrichment: country from Vercel's
 * geo header, device class from the user agent. Verification verdicts
 * (photo_verified/photo_rejected) are NOT accepted here — those are
 * emitted only by /api/verify-photo.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      anonId?: unknown;
      event?: unknown;
      src?: unknown;
      questId?: unknown;
      objectiveId?: unknown;
      referrer?: unknown;
    };

    if (typeof body.anonId !== "string" || !UUID_RE.test(body.anonId)) {
      return new NextResponse(null, { status: 204 });
    }
    if (typeof body.event !== "string" || !CLIENT_EVENTS.has(body.event)) {
      return new NextResponse(null, { status: 204 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return new NextResponse(null, { status: 204 });

    const country = request.headers.get("x-vercel-ip-country");
    const device = classifyDevice(request.headers.get("user-agent"));

    const supabase = createSupabaseClient(url, key);
    await supabase.rpc("log_event", {
      p_anon_id: body.anonId,
      p_event: body.event,
      p_src: typeof body.src === "string" ? body.src.slice(0, 64) : null,
      p_quest_id:
        typeof body.questId === "string" ? body.questId.slice(0, 64) : null,
      p_objective_id:
        typeof body.objectiveId === "string"
          ? body.objectiveId.slice(0, 64)
          : null,
      p_country: country,
      p_device: device,
      p_referrer:
        body.event === "session_start" && typeof body.referrer === "string"
          ? body.referrer.slice(0, 256)
          : null,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(
      "[events] ingestion failed:",
      error instanceof Error ? error.message : error,
    );
    return new NextResponse(null, { status: 204 });
  }
}
