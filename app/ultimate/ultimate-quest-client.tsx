"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { ArrowLeft, Trophy } from "lucide-react";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { getAllObjectives } from "@/lib/data/neighborhoods";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { ULTIMATE_QUEST_IDS } from "@/lib/data/quests";
import { ObjectiveItem } from "@/components/quest/objective-item";
import { ProgressRing } from "@/components/quest/progress-ring";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const allObjectives = getAllObjectives();
const ultimateObjectives = ULTIMATE_QUEST_IDS.map((id) =>
  allObjectives.find((o) => o.id === id)!,
);

function getNeighborhoodForObjective(id: string) {
  return NEIGHBORHOODS.find((n) => n.objectives.some((o) => o.id === id));
}

export function UltimateQuestClient() {
  const { progress, isCompleted } = useQuestProgress();
  const done = ULTIMATE_QUEST_IDS.filter((id) =>
    progress.completedObjectives.includes(id),
  ).length;
  const total = ULTIMATE_QUEST_IDS.length;
  const [showCompletion, setShowCompletion] = useState(false);
  const wasComplete = progress.ultimateCompleted;

  const fireConfetti = useCallback(() => {
    const colors = ["#004C54", "#E81828", "#006BB6", "#E8B931"];
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, []);

  useEffect(() => {
    if (progress.ultimateCompleted && !wasComplete) {
      setShowCompletion(true);
      fireConfetti();
    }
  }, [progress.ultimateCompleted, wasComplete, fireConfetti]);

  return (
    <main className="flex-1">
      <div className="h-2 w-full bg-gradient-to-r from-[#004C54] via-[#E81828] to-[#006BB6]" />

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
              <Trophy className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">The Ultimate Philly Quest</h1>
            </div>
            <p className="text-muted-foreground italic">
              &ldquo;Cross the whole city. Earn legendary status.&rdquo;
            </p>
          </div>
          <ProgressRing done={done} total={total} size={64} strokeWidth={4} />
        </div>

        <p className="text-muted-foreground mb-6">
          {total} handpicked objectives spanning every neighborhood.
          This is the definitive Philadelphia experience.
        </p>

        {progress.ultimateCompleted && (
          <div className="mb-6 rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-4 text-center">
            <Trophy className="h-10 w-10 text-primary mx-auto mb-2" />
            <p className="font-semibold text-primary text-lg">
              Ultimate Quest Complete!
            </p>
            <p className="text-sm text-muted-foreground">
              You are a true Philadelphia legend.
            </p>
          </div>
        )}

        <Separator className="mb-6" />

        <div className="space-y-3">
          {ultimateObjectives.map((objective, index) => {
            const neighborhood = getNeighborhoodForObjective(objective.id);
            return (
              <div key={objective.id}>
                {neighborhood && (
                  <Badge
                    variant="outline"
                    className="mb-1.5 text-[10px]"
                    style={{ borderColor: neighborhood.color, color: neighborhood.color }}
                  >
                    {neighborhood.emoji} {neighborhood.name}
                  </Badge>
                )}
                <ObjectiveItem objective={objective} index={index} />
              </div>
            );
          })}
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

      <Dialog
        open={showCompletion}
        onOpenChange={(v) => !v && setShowCompletion(false)}
      >
        <DialogContent className="text-center max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-4">
              <div className="animate-stamp inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-dashed border-primary text-primary">
                <Trophy className="h-10 w-10" />
              </div>
            </div>
            <DialogTitle className="text-2xl">
              You Are a Philly Legend!
            </DialogTitle>
            <DialogDescription className="text-base">
              You completed the Ultimate Philly Quest. Every neighborhood,
              every challenge, every bite. Philadelphia salutes you.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowCompletion(false)} className="mt-4">
            Bask in Glory
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
