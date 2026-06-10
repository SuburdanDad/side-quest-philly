"use client";

import { useState, useCallback } from "react";
import {
  ChevronDown,
  Lightbulb,
  Camera,
  ImageIcon,
  Share2,
  Loader2,
  BadgeCheck,
  RotateCcw,
} from "lucide-react";
import type { Objective } from "@/lib/types";
import { trackEvent } from "@/lib/analytics";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { useGamification } from "@/lib/hooks/use-gamification";
import { usePhotoStorage } from "@/lib/hooks/use-photo-storage";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { requestPhotoVerification } from "@/lib/photos/verify-client";
import { syncPhotoToCloud, removeCloudPhoto } from "@/lib/photos/sync";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { CATEGORY_XP, VERIFIED_PHOTO_XP } from "@/lib/gamification/xp";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryBadge } from "./category-badge";
import { PhotoCapture } from "./photo-capture";

type ObjectiveItemProps = {
  objective: Objective;
  index: number;
  neighborhoodSlug?: string;
  onComplete?: () => void;
};

export function ObjectiveItem({
  objective,
  index,
  neighborhoodSlug,
  onComplete,
}: ObjectiveItemProps) {
  const { isCompleted, toggleObjective, progress } = useQuestProgress();
  const { recordObjectiveCompletion, removeObjectiveCompletion, recordVerification } =
    useGamification();
  const { savePhoto, setVerification, getPhoto, removePhoto, verifiedCount } =
    usePhotoStorage();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [xpFlash, setXpFlash] = useState(false);
  const [bonusFlash, setBonusFlash] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [addingPhotoOnly, setAddingPhotoOnly] = useState(false);
  const [showPhotoFull, setShowPhotoFull] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const completed = isCompleted(objective.id);
  const photo = getPhoto(objective.id);

  const completeObjective = useCallback(() => {
    toggleObjective(objective.id);

    // Compute the "future" progress state after this toggle
    const newCompleted = [...progress.completedObjectives, objective.id];
    const newCompletedNeighborhoods = NEIGHBORHOODS.filter((n) =>
      n.objectives.every((o) => newCompleted.includes(o.id)),
    ).map((n) => n.id);

    recordObjectiveCompletion(
      objective.id,
      {
        ...progress,
        completedObjectives: newCompleted,
        completedNeighborhoods: newCompletedNeighborhoods,
      },
      verifiedCount,
    );

    setXpFlash(true);
    setTimeout(() => setXpFlash(false), 1500);

    trackEvent("objective_complete", {
      questId: neighborhoodSlug,
      objectiveId: objective.id,
    });

    if (onComplete) onComplete();
  }, [
    objective.id,
    neighborhoodSlug,
    toggleObjective,
    progress,
    recordObjectiveCompletion,
    verifiedCount,
    onComplete,
  ]);

  const runVerification = useCallback(
    async (dataUrl: string) => {
      setVerifying(true);
      try {
        const result = await requestPhotoVerification(objective.id, dataUrl);

        if (typeof result.verified === "boolean") {
          setVerification(objective.id, result.verified, result.reason);

          if (result.verified) {
            // Verified! Bonus XP flash + maybe a photo achievement.
            setBonusFlash(true);
            setTimeout(() => setBonusFlash(false), 2200);
            recordVerification(progress, verifiedCount + 1);
          }

          // Push photo + verdict to the cloud for the leaderboard
          if (user) {
            const supabase = createClient();
            if (supabase) {
              syncPhotoToCloud(supabase, user.id, objective.id, {
                dataUrl,
                verified: result.verified,
                reason: result.reason,
                savedAt: new Date().toISOString(),
              });
            }
          }
        } else if (user) {
          // Verification unavailable — still store the photo itself
          const supabase = createClient();
          if (supabase) {
            syncPhotoToCloud(supabase, user.id, objective.id, {
              dataUrl,
              verified: null,
              reason: null,
              savedAt: new Date().toISOString(),
            });
          }
        }
      } finally {
        setVerifying(false);
      }
    },
    [
      objective.id,
      setVerification,
      recordVerification,
      progress,
      verifiedCount,
      user,
    ],
  );

  function handleToggle() {
    if (!completed) {
      setAddingPhotoOnly(false);
      setShowCamera(true);
      return;
    }

    // Un-completing: clear local + cloud photo state
    toggleObjective(objective.id);
    removeObjectiveCompletion(objective.id);
    removePhoto(objective.id);
    if (user) {
      const supabase = createClient();
      if (supabase) removeCloudPhoto(supabase, user.id, objective.id);
    }
  }

  const handlePhotoCaptured = useCallback(
    async (file: File) => {
      setShowCamera(false);
      const entry = await savePhoto(objective.id, file);

      if (!addingPhotoOnly) {
        completeObjective();
      } else {
        setAddingPhotoOnly(false);
      }

      // Judge in the background — gameplay never waits on the AI.
      runVerification(entry.dataUrl);
    },
    [objective.id, addingPhotoOnly, savePhoto, completeObjective, runVerification],
  );

  const handleSkipPhoto = useCallback(() => {
    setShowCamera(false);
    if (addingPhotoOnly) {
      setAddingPhotoOnly(false);
      return;
    }
    completeObjective();
  }, [addingPhotoOnly, completeObjective]);

  function handleRetakePhoto() {
    setAddingPhotoOnly(true);
    setShowCamera(true);
  }

  async function handleShareObjective() {
    if (!photo || !neighborhoodSlug) return;
    setSharing(true);
    trackEvent("share", { questId: neighborhoodSlug, objectiveId: objective.id });

    try {
      const response = await fetch("/api/share-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          neighborhood: neighborhoodSlug,
          objectiveTitle: objective.title,
          verified: photo.verified === true,
          photo: photo.dataUrl,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate");
      const blob = await response.blob();

      if (navigator.canShare) {
        const file = new File([blob], "side-quest-philly.png", {
          type: "image/png",
        });
        const shareData = {
          files: [file],
          title: objective.title,
          text: `${objective.title} — completed! #SideQuestPhilly`,
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }

      const text = `I just completed "${objective.title}" in the Side Quest Philadelphia scavenger hunt!\n\nhttps://side-quest-philly.vercel.app\n#SideQuestPhilly`;
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // User cancelled or share failed
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <div
        className={`rounded-xl border bg-card p-4 transition-all duration-200 ${completed ? "border-primary/20 bg-primary/[0.03]" : "hover:border-foreground/10"}`}
      >
        <div className="flex items-start gap-3">
          <div className="pt-0.5">
            <Checkbox
              checked={completed}
              onCheckedChange={handleToggle}
              className={`h-5 w-5 rounded-full ${completed ? "animate-check-bounce" : ""}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <CategoryBadge category={objective.category} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={`font-semibold text-sm sm:text-base transition-all ${completed ? "line-through text-muted-foreground" : ""}`}
              >
                {objective.title}
              </h3>
              {xpFlash && (
                <span className="text-[10px] font-black text-[#C9A84C] animate-bounce">
                  +{CATEGORY_XP[objective.category]} XP
                </span>
              )}
              {bonusFlash && (
                <span className="text-[10px] font-black text-emerald-600 animate-bounce">
                  +{VERIFIED_PHOTO_XP} XP Verified!
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {objective.description}
            </p>

            {/* Photo proof */}
            {completed && photo && (
              <div className="mt-3">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setShowPhotoFull(!showPhotoFull)}
                    className="group flex-shrink-0"
                    aria-label="Toggle photo preview"
                  >
                    <div
                      className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 shadow-sm ${
                        photo.verified
                          ? "border-[#C9A84C]"
                          : "border-[#C9A84C]/30"
                      }`}
                    >
                      <img
                        src={photo.dataUrl}
                        alt="Your photo proof"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      {photo.verified && (
                        <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-[#C9A84C] flex items-center justify-center">
                          <BadgeCheck className="h-3 w-3 text-[#0F1D36]" />
                        </div>
                      )}
                    </div>
                  </button>

                  <div className="min-w-0">
                    {verifying ? (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Judging your photo...
                      </div>
                    ) : photo.verified === true ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#C9A84C]">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        AI Verified · +{VERIFIED_PHOTO_XP} XP
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Camera className="h-3 w-3" />
                        Photo saved
                      </div>
                    )}

                    {!verifying && photo.reason && (
                      <p className="text-xs text-muted-foreground italic mt-0.5 leading-snug">
                        &ldquo;{photo.reason}&rdquo;
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1">
                      {!verifying && photo.verified === false && (
                        <button
                          onClick={handleRetakePhoto}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:text-amber-700 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Try another photo
                        </button>
                      )}
                      {neighborhoodSlug && (
                        <button
                          onClick={handleShareObjective}
                          disabled={sharing}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-[#C9A84C] transition-colors disabled:opacity-50"
                        >
                          {sharing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Share2 className="h-3 w-3" />
                          )}
                          {sharing ? "Creating..." : "Share"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {showPhotoFull && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-[#C9A84C]/20 shadow-md">
                    <img
                      src={photo.dataUrl}
                      alt="Your photo proof"
                      className="w-full aspect-[4/3] object-cover"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Completed without photo — offer to add one */}
            {completed && !photo && (
              <button
                onClick={handleRetakePhoto}
                className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-[#C9A84C] transition-colors"
              >
                <ImageIcon className="h-3 w-3" />
                Add photo proof · earn +{VERIFIED_PHOTO_XP} XP
              </button>
            )}

            {completed && objective.funFact && (
              <div className="mt-3 rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm text-foreground">
                <span className="font-semibold text-primary">Fun Fact: </span>
                {objective.funFact}
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setShowHint(!showHint)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                {showHint ? "Hide hint" : "Need a hint?"}
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors sm:hidden"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
                {expanded ? "Less" : "More"}
              </button>
            </div>

            {showHint && (
              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                <Lightbulb className="inline h-3.5 w-3.5 mr-1.5" />
                {objective.hint}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo capture modal */}
      <PhotoCapture
        open={showCamera}
        objectiveTitle={objective.title}
        onCapture={handlePhotoCaptured}
        onClose={handleSkipPhoto}
      />
    </>
  );
}
