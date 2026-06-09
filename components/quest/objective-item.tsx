"use client";

import { useState, useCallback } from "react";
import { ChevronDown, Lightbulb, Camera, ImageIcon, Share2, Loader2 } from "lucide-react";
import type { Objective } from "@/lib/types";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { useGamification } from "@/lib/hooks/use-gamification";
import { usePhotoStorage } from "@/lib/hooks/use-photo-storage";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { CATEGORY_XP } from "@/lib/gamification/xp";
import { calculateXP } from "@/lib/gamification/xp";
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
  const { recordObjectiveCompletion, removeObjectiveCompletion } =
    useGamification();
  const { savePhoto, getPhoto, removePhoto } = usePhotoStorage();
  const [expanded, setExpanded] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [xpFlash, setXpFlash] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [addingPhotoOnly, setAddingPhotoOnly] = useState(false);
  const [showPhotoFull, setShowPhotoFull] = useState(false);
  const [sharing, setSharing] = useState(false);
  const completed = isCompleted(objective.id);
  const photo = getPhoto(objective.id);

  function handleToggle() {
    if (!completed) {
      // Opening camera — don't toggle yet
      setAddingPhotoOnly(false);
      setShowCamera(true);
      return;
    }

    // Uncompleting — toggle immediately
    toggleObjective(objective.id);
    removeObjectiveCompletion(objective.id);
    removePhoto(objective.id);
  }

  function handleAddPhotoToCompleted() {
    setAddingPhotoOnly(true);
    setShowCamera(true);
  }

  const handlePhotoCaptured = useCallback(
    async (file: File) => {
      setShowCamera(false);

      // Save photo
      await savePhoto(objective.id, file);

      // If we're just adding a photo to an already-completed objective, stop here
      if (addingPhotoOnly) {
        setAddingPhotoOnly(false);
        return;
      }

      // Mark as complete
      toggleObjective(objective.id);

      // Compute the "future" progress state after this toggle
      const newCompleted = [...progress.completedObjectives, objective.id];
      const newCompletedNeighborhoods = NEIGHBORHOODS.filter((n) =>
        n.objectives.every((o) => newCompleted.includes(o.id)),
      ).map((n) => n.id);

      recordObjectiveCompletion(objective.id, {
        ...progress,
        completedObjectives: newCompleted,
        completedNeighborhoods: newCompletedNeighborhoods,
      });

      // XP flash
      setXpFlash(true);
      setTimeout(() => setXpFlash(false), 1500);

      if (onComplete) onComplete();
    },
    [
      objective.id,
      addingPhotoOnly,
      savePhoto,
      toggleObjective,
      progress,
      recordObjectiveCompletion,
      onComplete,
    ],
  );

  const handleSkipPhoto = useCallback(() => {
    setShowCamera(false);

    // If just adding photo to completed objective, do nothing on skip
    if (addingPhotoOnly) {
      setAddingPhotoOnly(false);
      return;
    }

    // Complete without photo
    toggleObjective(objective.id);

    const newCompleted = [...progress.completedObjectives, objective.id];
    const newCompletedNeighborhoods = NEIGHBORHOODS.filter((n) =>
      n.objectives.every((o) => newCompleted.includes(o.id)),
    ).map((n) => n.id);

    recordObjectiveCompletion(objective.id, {
      ...progress,
      completedObjectives: newCompleted,
      completedNeighborhoods: newCompletedNeighborhoods,
    });

    setXpFlash(true);
    setTimeout(() => setXpFlash(false), 1500);

    if (onComplete) onComplete();
  }, [
    objective.id,
    addingPhotoOnly,
    toggleObjective,
    progress,
    recordObjectiveCompletion,
    onComplete,
  ]);

  async function handleShareObjective() {
    if (!photo || !neighborhoodSlug) return;
    setSharing(true);

    try {
      const allObjectives = NEIGHBORHOODS.flatMap((n) =>
        n.objectives.map((o) => ({ id: o.id, category: o.category })),
      );
      const xp = calculateXP(progress.completedObjectives, allObjectives);

      const response = await fetch("/api/share-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          neighborhood: neighborhoodSlug,
          xp,
          stamps: progress.completedNeighborhoods.length,
          objectiveTitle: objective.title,
          photo,
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

      // Fallback: text share
      const text = `I just completed "${objective.title}" in the Side Quest Philadelphia scavenger hunt!\n\n#SideQuestPhilly`;
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
            <div className="flex items-center gap-2">
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
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {objective.description}
            </p>

            {/* Photo proof thumbnail */}
            {completed && photo && (
              <div className="mt-3">
                <button
                  onClick={() => setShowPhotoFull(!showPhotoFull)}
                  className="group"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-[#C9A84C]/30 shadow-sm">
                      <img
                        src={photo}
                        alt="Your photo proof"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#C9A84C]">
                      <Camera className="h-3 w-3" />
                      Verified
                    </div>
                  </div>
                </button>

                {/* Share button for verified objectives */}
                {neighborhoodSlug && (
                  <button
                    onClick={handleShareObjective}
                    disabled={sharing}
                    className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-[#C9A84C] transition-colors disabled:opacity-50"
                  >
                    {sharing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Share2 className="h-3 w-3" />
                    )}
                    {sharing ? "Creating..." : "Share to Stories"}
                  </button>
                )}
              </div>
            )}

            {/* Expanded photo view */}
            {showPhotoFull && photo && (
              <div className="mt-2 rounded-xl overflow-hidden border border-[#C9A84C]/20 shadow-md">
                <img
                  src={photo}
                  alt="Your photo proof"
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
            )}

            {/* Completed without photo — offer to add one */}
            {completed && !photo && (
              <button
                onClick={handleAddPhotoToCompleted}
                className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-[#C9A84C] transition-colors"
              >
                <ImageIcon className="h-3 w-3" />
                Add photo proof
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
