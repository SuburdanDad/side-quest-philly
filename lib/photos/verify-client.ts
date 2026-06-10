"use client";

import {
  UNAVAILABLE,
  type VerificationResult,
} from "@/lib/photos/verification";

/**
 * Ask the AI judge whether this photo completes the objective.
 * Never throws — on any failure the photo simply stays unverified.
 */
export async function requestPhotoVerification(
  objectiveId: string,
  dataUrl: string,
): Promise<VerificationResult> {
  try {
    const response = await fetch("/api/verify-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectiveId, photo: dataUrl }),
    });
    if (!response.ok) return UNAVAILABLE;
    const result = (await response.json()) as VerificationResult;
    return typeof result.verified === "boolean" ? result : UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}
