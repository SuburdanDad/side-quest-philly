import { NextResponse, type NextRequest } from "next/server";
import { generateText, Output, jsonSchema } from "ai";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { findObjective } from "@/lib/data/all-objectives";
import {
  UNAVAILABLE,
  VERIFICATION_JSON_SCHEMA,
  buildVerificationSystemPrompt,
  buildVerificationUserPrompt,
  isAcceptablePhotoPayload,
  toVerificationResult,
} from "@/lib/photos/verification";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vision judge: fast + cheap. Auth: AI Gateway via Vercel OIDC in
// deployments, or AI_GATEWAY_API_KEY locally.
const JUDGE_MODEL = "anthropic/claude-haiku-4.5";

function gatewayConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL ||
      process.env.VERCEL_OIDC_TOKEN,
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The billable/analytics event for a verification verdict is emitted
 * HERE, server-side — the client cannot post photo_verified. Verdict
 * and event share one codepath.
 */
async function logVerdictEvent(
  anonId: unknown,
  verified: boolean,
  questId: string,
  objectiveId: string,
) {
  try {
    if (typeof anonId !== "string" || !UUID_RE.test(anonId)) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supabase = createSupabaseClient(url, key);
    await supabase.rpc("log_event", {
      p_anon_id: anonId,
      p_event: verified ? "photo_verified" : "photo_rejected",
      p_src: null,
      p_quest_id: questId,
      p_objective_id: objectiveId,
    });
  } catch {
    // analytics must never break verification
  }
}

export async function POST(request: NextRequest) {
  let objectiveId = "unknown";
  try {
    const body = (await request.json()) as {
      objectiveId?: unknown;
      photo?: unknown;
      anonId?: unknown;
    };

    if (typeof body.objectiveId !== "string") {
      return NextResponse.json({ error: "Missing objectiveId" }, { status: 400 });
    }
    objectiveId = body.objectiveId;

    // Look the objective up server-side so the prompt can't be spoofed
    // with an easier description than the real quest.
    const ctx = findObjective(body.objectiveId);
    if (!ctx) {
      return NextResponse.json({ error: "Unknown objective" }, { status: 404 });
    }

    if (!isAcceptablePhotoPayload(body.photo)) {
      return NextResponse.json({ error: "Invalid photo" }, { status: 400 });
    }

    if (!gatewayConfigured()) {
      // Local dev without gateway credentials: photo still counts,
      // it just stays un-verified.
      return NextResponse.json(UNAVAILABLE);
    }

    const { output } = await generateText({
      model: JUDGE_MODEL,
      output: Output.object({
        schema: jsonSchema<{
          verified: boolean;
          confidence: number;
          reason: string;
        }>(VERIFICATION_JSON_SCHEMA),
        name: "photo_verdict",
      }),
      system: buildVerificationSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildVerificationUserPrompt(ctx) },
            { type: "image", image: body.photo },
          ],
        },
      ],
      providerOptions: {
        gateway: {
          tags: ["feature:photo-verification"],
          models: ["anthropic/claude-sonnet-4.6"],
        },
      },
      abortSignal: AbortSignal.timeout(45_000),
    });

    const result = toVerificationResult(output);
    if (typeof result.verified === "boolean") {
      await logVerdictEvent(
        body.anonId,
        result.verified,
        ctx.questId,
        body.objectiveId,
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    // Verification must never block gameplay — log and degrade.
    console.error(
      `[verify-photo] objective=${objectiveId} failed:`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(UNAVAILABLE);
  }
}
