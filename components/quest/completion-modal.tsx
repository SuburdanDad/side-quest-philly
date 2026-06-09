"use client";

import { useEffect, useCallback, useState } from "react";
import confetti from "canvas-confetti";
import { Share2, Loader2 } from "lucide-react";
import type { Neighborhood } from "@/lib/types";
import { useGamification } from "@/lib/hooks/use-gamification";
import { calculateXP } from "@/lib/gamification/xp";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { usePhotoStorage } from "@/lib/hooks/use-photo-storage";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width={20} height={20} x={2} y={2} rx={5} ry={5} />
      <circle cx={12} cy={12} r={5} />
      <circle cx={17.5} cy={6.5} r={1} fill="currentColor" stroke="none" />
    </svg>
  );
}

type CompletionModalProps = {
  neighborhood: Neighborhood;
  open: boolean;
  onClose: () => void;
};

export function CompletionModal({
  neighborhood,
  open,
  onClose,
}: CompletionModalProps) {
  const [phase, setPhase] = useState<
    "overlay" | "stamp" | "stats" | "done"
  >("overlay");
  const { progress } = useQuestProgress();
  const { gamification } = useGamification();
  const { photos } = usePhotoStorage();
  const [sharing, setSharing] = useState(false);

  const allObjectives = NEIGHBORHOODS.flatMap((n) =>
    n.objectives.map((o) => ({ id: o.id, category: o.category })),
  );
  const xp = calculateXP(progress.completedObjectives, allObjectives);

  // Find a photo from this neighborhood's objectives to use in the share card
  const neighborhoodPhoto = neighborhood.objectives
    .map((o) => photos[o.id])
    .find(Boolean);

  // Count photos taken in this neighborhood
  const photoCount = neighborhood.objectives.filter(
    (o) => photos[o.id],
  ).length;

  const fireConfetti = useCallback(() => {
    const colors = ["#0F1D36", "#C9A84C", "#B22234", "#3C3B6E"];

    // Initial burst
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors,
      startVelocity: 45,
    });

    // Side bursts
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors,
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors,
      });
    }, 300);

    // Final shower
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.3 },
        colors,
        startVelocity: 30,
        gravity: 0.8,
      });
    }, 700);
  }, []);

  useEffect(() => {
    if (!open) {
      setPhase("overlay");
      return;
    }

    // Phase 1: Dark overlay fades in
    setPhase("overlay");

    // Phase 2: Stamp slams in (after brief delay)
    const stampTimer = setTimeout(() => {
      setPhase("stamp");
      // Haptic feedback (Android only)
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 200]);
      }
      fireConfetti();
    }, 400);

    // Phase 3: Stats and buttons appear
    const statsTimer = setTimeout(() => {
      setPhase("stats");
    }, 1800);

    // Auto-mark as done (user can dismiss anytime)
    const doneTimer = setTimeout(() => {
      setPhase("done");
    }, 2500);

    return () => {
      clearTimeout(stampTimer);
      clearTimeout(statsTimer);
      clearTimeout(doneTimer);
    };
  }, [open, fireConfetti]);

  async function generateShareCard(): Promise<Blob | null> {
    try {
      const response = await fetch("/api/share-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          neighborhood: neighborhood.slug,
          xp,
          stamps: progress.completedNeighborhoods.length,
          objectiveTitle: `${photoCount}/${neighborhood.objectives.length} objectives verified`,
          photo: neighborhoodPhoto ?? undefined,
        }),
      });

      if (!response.ok) return null;
      return await response.blob();
    } catch {
      return null;
    }
  }

  async function handleShareWithImage() {
    setSharing(true);
    try {
      const blob = await generateShareCard();

      if (blob && navigator.canShare) {
        const file = new File([blob], "side-quest-philly.png", {
          type: "image/png",
        });
        const shareData = {
          files: [file],
          title: `${neighborhood.name} Quest Complete!`,
          text: `I just completed the ${neighborhood.name} Side Quest in Philadelphia! ${neighborhood.emoji}\n\n${xp} XP earned\n\n#SideQuestPhilly`,
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }

      // Fallback: text-only share
      await handleShareText();
    } catch {
      // User cancelled share or share failed
    } finally {
      setSharing(false);
    }
  }

  async function handleShareText() {
    const text = `I just completed the ${neighborhood.name} Side Quest in Philadelphia! ${neighborhood.emoji}\n\n${xp} XP earned · ${progress.completedNeighborhoods.length} stamps collected\n\nhttps://side-quest-philly.vercel.app\n#SideQuestPhilly`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => phase === "done" && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Quest complete celebration"
    >
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-[#0F1D36] transition-opacity duration-500"
        style={{ opacity: phase === "overlay" ? 0 : 0.95 }}
      />

      {/* Radial glow behind stamp */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: phase !== "overlay" ? 1 : 0,
          background: `radial-gradient(circle at 50% 45%, ${neighborhood.color}30, transparent 60%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-white px-6 max-w-sm w-full">
        {/* Stamp */}
        <div
          className={`transition-all ${
            phase === "overlay"
              ? "scale-0 opacity-0"
              : phase === "stamp"
                ? "animate-stamp-slam"
                : "scale-100 opacity-100"
          }`}
        >
          {/* Show neighborhood photo collage or stamp */}
          {neighborhoodPhoto ? (
            <div className="relative">
              <div
                className="w-28 h-28 rounded-full overflow-hidden border-4 shadow-[0_0_40px_rgba(201,168,76,0.3)]"
                style={{ borderColor: neighborhood.color }}
              >
                <img
                  src={neighborhoodPhoto}
                  alt="Quest photo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#C9A84C] flex items-center justify-center text-[#0F1D36] font-black text-sm shadow-lg">
                {photoCount}
              </div>
            </div>
          ) : (
            <div
              className="w-28 h-28 rounded-full border-4 border-dashed flex items-center justify-center shadow-[0_0_40px_rgba(201,168,76,0.3)]"
              style={{
                borderColor: neighborhood.color,
                backgroundColor: `${neighborhood.color}15`,
              }}
            >
              <span className="text-5xl drop-shadow-lg">
                {neighborhood.emoji}
              </span>
            </div>
          )}
        </div>

        {/* Neighborhood name */}
        <div
          className={`mt-6 text-center transition-all duration-500 ${
            phase === "overlay" || phase === "stamp"
              ? "opacity-0 translate-y-4"
              : "opacity-100 translate-y-0"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">
            Quest Complete
          </p>
          <h2 className="text-3xl font-black tracking-tight">
            {neighborhood.name}
          </h2>
          <p className="text-white/60 text-sm mt-1 italic">
            &ldquo;{neighborhood.tagline}&rdquo;
          </p>
        </div>

        {/* XP + Stats */}
        <div
          className={`mt-6 flex items-center gap-6 transition-all duration-500 delay-200 ${
            phase === "overlay" || phase === "stamp"
              ? "opacity-0 translate-y-4"
              : "opacity-100 translate-y-0"
          }`}
        >
          <div className="text-center">
            <p className="text-2xl font-black text-[#C9A84C]">{xp}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              Total XP
            </p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-black">
              {progress.completedNeighborhoods.length}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              Stamps
            </p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-black">
              {photoCount}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              Photos
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div
          className={`mt-8 flex flex-col gap-2.5 w-full transition-all duration-500 delay-300 ${
            phase === "done"
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          {/* Primary: Share with branded image */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleShareWithImage();
            }}
            disabled={sharing}
            className="w-full rounded-xl bg-gradient-to-r from-[#833AB4] via-[#C13584] to-[#F77737] text-white py-3.5 font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <InstagramIcon className="h-4 w-4" />
            )}
            {sharing ? "Creating card..." : "Share to Stories"}
          </button>

          {/* Secondary: Plain text share */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleShareText();
            }}
            className="w-full rounded-xl bg-white text-[#0F1D36] py-3 font-bold text-sm hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share Achievement
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-full rounded-xl border border-white/20 text-white py-3 font-bold text-sm hover:bg-white/10 transition-colors"
          >
            Keep Exploring
          </button>
        </div>

        {/* Tap to dismiss hint */}
        <p
          className={`mt-6 text-[10px] text-white/20 uppercase tracking-wider transition-opacity duration-500 ${
            phase === "done" ? "opacity-100" : "opacity-0"
          }`}
        >
          Tap anywhere to dismiss
        </p>
      </div>
    </div>
  );
}
