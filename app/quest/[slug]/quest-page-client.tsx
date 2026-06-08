"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Neighborhood } from "@/lib/types";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { ProgressRing } from "@/components/quest/progress-ring";
import { ObjectiveItem } from "@/components/quest/objective-item";
import { CompletionModal } from "@/components/quest/completion-modal";
import { Button } from "@/components/ui/button";

type QuestPageClientProps = {
  neighborhood: Neighborhood;
};

export function QuestPageClient({ neighborhood }: QuestPageClientProps) {
  const { getNeighborhoodProgress, progress } = useQuestProgress();
  const { done, total } = getNeighborhoodProgress(neighborhood.slug);
  const [showCompletion, setShowCompletion] = useState(false);
  const prevDoneRef = useRef(done);

  const isComplete = progress.completedNeighborhoods.includes(neighborhood.id);

  function handleObjectiveComplete() {
    const newProgress = done + 1;
    if (newProgress === total && prevDoneRef.current < total) {
      setTimeout(() => setShowCompletion(true), 300);
    }
    prevDoneRef.current = newProgress;
  }

  return (
    <main className="flex-1">
      {/* Neighborhood hero with background photo */}
      <section className="relative overflow-hidden text-white">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/neighborhoods/${neighborhood.slug}.jpg')`,
          }}
        />
        {/* Color-tinted overlay using neighborhood color */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${neighborhood.color}cc 0%, ${neighborhood.color}99 50%, ${neighborhood.color}dd 100%)`,
          }}
        />

        {/* Top bar in neighborhood color */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5 z-10"
          style={{ backgroundColor: neighborhood.color }}
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
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="text-4xl drop-shadow-lg">{neighborhood.emoji}</span>
                <h1 className="text-3xl font-black tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                  {neighborhood.name}
                </h1>
              </div>
              <p className="text-white/80 italic text-sm drop-shadow-sm">
                &ldquo;{neighborhood.tagline}&rdquo;
              </p>
            </div>
            <div className="flex-shrink-0 bg-white/15 backdrop-blur-md rounded-full p-1.5">
              <ProgressRing done={done} total={total} size={52} strokeWidth={3} />
            </div>
          </div>

          <p className="text-white/70 text-sm mt-3 leading-relaxed drop-shadow-sm">
            {neighborhood.description}
          </p>
        </div>

        {/* Bottom fade into page */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
      </section>

      <div className="mx-auto max-w-lg px-4 py-6">
        {isComplete && (
          <div className="mb-4 rounded-xl border-2 p-4 text-center" style={{ borderColor: neighborhood.color + "40", backgroundColor: neighborhood.color + "08" }}>
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full border-4 border-dashed mb-2"
              style={{
                borderColor: neighborhood.color,
                color: neighborhood.color,
              }}
            >
              <span className="text-2xl">{neighborhood.emoji}</span>
            </div>
            <p className="font-bold text-sm" style={{ color: neighborhood.color }}>
              Quest Complete — Stamp Earned!
            </p>
          </div>
        )}

        <h2 className="text-xs font-black uppercase tracking-wide text-muted-foreground mb-3">
          Objectives · {done}/{total}
        </h2>

        <div className="space-y-2.5">
          {neighborhood.objectives.map((objective, index) => (
            <ObjectiveItem
              key={objective.id}
              objective={objective}
              index={index}
              onComplete={handleObjectiveComplete}
            />
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to All Quests
            </Button>
          </Link>
        </div>
      </div>

      <CompletionModal
        neighborhood={neighborhood}
        open={showCompletion}
        onClose={() => setShowCompletion(false)}
      />
    </main>
  );
}
