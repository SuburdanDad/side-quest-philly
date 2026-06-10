import { NextResponse, type NextRequest } from "next/server";
import { generateText, Output, jsonSchema } from "ai";
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

export async function POST(request: NextRequest) {
  let objectiveId = "unknown";
  try {
    const body = (await request.json()) as {
      objectiveId?: unknown;
      photo?: unknown;
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

    return NextResponse.json(toVerificationResult(output));
  } catch (error) {
    // Verification must never block gameplay — log and degrade.
    console.error(
      `[verify-photo] objective=${objectiveId} failed:`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(UNAVAILABLE);
  }
}
