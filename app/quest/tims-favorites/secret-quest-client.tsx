"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { ProgressRing } from "@/components/quest/progress-ring";
import { ObjectiveItem } from "@/components/quest/objective-item";
import { CompletionModal } from "@/components/quest/completion-modal";
import type { SecretQuest } from "@/lib/data/secret-quests";
import { isSecretQuestUnlocked } from "@/lib/data/secret-quests";

type SecretQuestClientProps = {
  quest: SecretQuest;
};

export function SecretQuestClient({ quest }: SecretQuestClientProps) {
  const { progress, getNeighborhoodProgress } = useQuestProgress();
  const unlocked = isSecretQuestUnlocked(progress.completedNeighborhoods, quest);
  const [showCompletion, setShowCompletion] = useState(false);
  const prevDoneRef = useRef(0);

  // Calculate progress for this secret quest
  const done = quest.objectives.filter((o) =>
    progress.completedObjectives.includes(o.id),
  ).length;
  const total = quest.objectives.length;

  // Initialize ref
  if (prevDoneRef.current === 0 && done > 0) {
    prevDoneRef.current = done;
  }

  function handleObjectiveComplete() {
    const newProgress = done + 1;
    if (newProgress === total && prevDoneRef.current < total) {
      setTimeout(() => setShowCompletion(true), 300);
    }
    prevDoneRef.current = newProgress;
  }

  // Locked state
  if (!unlocked) {
    return (
      <main className="flex-1">
        <div className="bg-[#0F1D36] text-white">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C9A84C] via-[#B22234] to-[#C9A84C]" />
          <div className="mx-auto max-w-lg px-4 pt-6 pb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <h1 className="text-2xl font-black uppercase tracking-wide">
              {quest.emoji} {quest.name}
            </h1>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-4 py-12">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-wide">
              Quest Locked
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Complete {quest.unlockRequirement} neighborhood quests to unlock
              Tim&apos;s personal favorite spots in Philadelphia. You&apos;ve
              completed{" "}
              <span className="font-bold text-foreground">
                {progress.completedNeighborhoods.length}
              </span>{" "}
              so far.
            </p>

            {/* Progress indicators */}
            <div className="flex items-center justify-center gap-2 pt-2">
              {Array.from({ length: quest.unlockRequirement }).map((_, i) => (
                <div
                  key={i}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg transition-all ${
                    i < progress.completedNeighborhoods.length
                      ? "border-[#C9A84C] bg-[#C9A84C]/10"
                      : "border-dashed border-muted-foreground/30"
                  }`}
                >
                  {i < progress.completedNeighborhoods.length ? "✓" : "?"}
                </div>
              ))}
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-[#0F1D36] text-white px-6 py-2.5 text-sm font-bold hover:bg-[#0F1D36]/90 transition-colors mt-4"
            >
              Choose a Neighborhood
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Unlocked state — render like a normal quest page
  const isComplete = done === total && total > 0;

  return (
    <main className="flex-1">
      {/* Secret quest hero */}
      <section className="relative overflow-hidden text-white">
        <div className="absolute inset-0 bg-[#0F1D36]" />
        {/* Gold shimmer overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 50%, rgba(201,168,76,0.15), transparent 60%), radial-gradient(circle at 80% 30%, rgba(201,168,76,0.1), transparent 50%)",
          }}
        />

        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ background: "linear-gradient(to right, #C9A84C, #B22234, #C9A84C)" }}
        />

        <div className="relative mx-auto max-w-lg px-4 pt-6 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            All Quests
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 mb-2 px-2.5 py-0.5 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/30">
                <span className="text-xs">🤫</span>
                <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">
                  Secret Quest
                </span>
              </div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="text-4xl drop-shadow-lg">{quest.emoji}</span>
                <h1 className="text-3xl font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                  {quest.name}
                </h1>
              </div>
              <p className="text-white/80 italic text-sm drop-shadow-sm">
                &ldquo;{quest.tagline}&rdquo;
              </p>
            </div>
            <div className="flex-shrink-0 bg-white/15 backdrop-blur-md rounded-full p-1.5">
              <ProgressRing done={done} total={total} size={52} strokeWidth={3} />
            </div>
          </div>

          <p className="text-white/70 text-sm mt-3 leading-relaxed drop-shadow-sm">
            {quest.description}
          </p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
      </section>

      <div className="mx-auto max-w-lg px-4 py-6">
        {isComplete && (
          <div className="mb-4 rounded-xl border-2 p-4 text-center border-[#C9A84C]/40 bg-[#C9A84C]/5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border-4 border-dashed mb-2 border-[#C9A84C] text-[#C9A84C]">
              <span className="text-2xl">{quest.emoji}</span>
            </div>
            <p className="font-bold text-sm text-[#C9A84C]">
              Tim&apos;s Favorites Complete — You&apos;re an Honorary Local!
            </p>
          </div>
        )}

        <h2 className="text-xs font-black uppercase tracking-wide text-muted-foreground mb-3">
          Tim&apos;s Picks &middot; {done}/{total}
        </h2>

        <div className="space-y-2.5">
          {quest.objectives.map((objective, index) => (
            <ObjectiveItem
              key={objective.id}
              objective={objective}
              index={index}
              onComplete={handleObjectiveComplete}
            />
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to All Quests
          </Link>
        </div>
      </div>

      <CompletionModal
        neighborhood={quest}
        open={showCompletion}
        onClose={() => setShowCompletion(false)}
      />
    </main>
  );
}
