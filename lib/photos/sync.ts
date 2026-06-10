"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PhotoEntry, PhotoStore } from "@/lib/hooks/use-photo-storage";

const BUCKET = "quest-photos";

function photoPath(userId: string, objectiveId: string): string {
  return `${userId}/${objectiveId}.jpg`;
}

/**
 * Upload one photo to Supabase Storage and record it (plus its
 * verification verdict) on the user_progress row. Upsert handles the
 * race with toggleObjective's own fire-and-forget upsert.
 */
export async function syncPhotoToCloud(
  supabase: SupabaseClient,
  userId: string,
  objectiveId: string,
  entry: PhotoEntry,
): Promise<void> {
  try {
    const blob = await (await fetch(entry.dataUrl)).blob();
    const path = photoPath(userId, objectiveId);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) throw uploadError;

    const { error: rowError } = await supabase.from("user_progress").upsert(
      {
        user_id: userId,
        objective_id: objectiveId,
        photo_url: path,
        photo_verified: entry.verified,
        photo_verify_reason: entry.reason,
      },
      { onConflict: "user_id,objective_id" },
    );
    if (rowError) throw rowError;
  } catch (error) {
    // Cloud sync is best-effort; localStorage remains the source of truth.
    console.error(`[photo-sync] upload failed for ${objectiveId}:`, error);
  }
}

/** Remove the stored photo when an objective is un-completed. */
export async function removeCloudPhoto(
  supabase: SupabaseClient,
  userId: string,
  objectiveId: string,
): Promise<void> {
  try {
    await supabase.storage
      .from(BUCKET)
      .remove([photoPath(userId, objectiveId)]);
  } catch (error) {
    console.error(`[photo-sync] remove failed for ${objectiveId}:`, error);
  }
}

/** On login, push every local photo up so the leaderboard sees them. */
export async function syncAllPhotosToCloud(
  supabase: SupabaseClient,
  userId: string,
  photos: PhotoStore,
): Promise<void> {
  for (const [objectiveId, entry] of Object.entries(photos)) {
    await syncPhotoToCloud(supabase, userId, objectiveId, entry);
  }
}
