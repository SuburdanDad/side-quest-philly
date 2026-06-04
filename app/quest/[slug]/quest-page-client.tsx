"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import type { Neighborhood } from "@/lib/types";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { ProgressRing } from "@/components/quest/progress-ring";
import { ObjectiveItem } from "@/components/quest/objective-item";
import { CompletionModal } from "@/components/quest/completion-modal";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
      <div
        className="h-2 w-full"
        style={{ backgroundColor: neighborhood.color }}
      />

      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          All Quests
        </Link>

        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">{neighborhood.emoji}</span>
              <h1 className="text-3xl font-bold">{neighborhood.name}</h1>
            </div>
            <p className="text-muted-foreground italic">
              &ldquo;{neighborhood.tagline}&rdquo;
            </p>
          </div>
          <ProgressRing done={done} total={total} size={64} strokeWidth={4} />
        </div>

        <p className="text-muted-foreground mb-6">{neighborhood.description}</p>

        {isComplete && (
          <div className="mb-6 rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-4 text-center">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full border-4 border-dashed mb-2"
              style={{
                borderColor: neighborhood.color,
                color: neighborhood.color,
              }}
            >
              <span className="text-2xl">{neighborhood.emoji}</span>
            </div>
            <p className="font-semibold text-primary">
              Quest Complete — Stamp Earned!
            </p>
          </div>
        )}

        <Separator className="mb-6" />

        <div className="space-y-3">
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
