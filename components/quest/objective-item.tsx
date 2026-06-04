"use client";

import { useState } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";
import type { Objective } from "@/lib/types";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryBadge } from "./category-badge";

type ObjectiveItemProps = {
  objective: Objective;
  index: number;
  onComplete?: () => void;
};

export function ObjectiveItem({
  objective,
  index,
  onComplete,
}: ObjectiveItemProps) {
  const { isCompleted, toggleObjective } = useQuestProgress();
  const [expanded, setExpanded] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const completed = isCompleted(objective.id);

  function handleToggle() {
    const wasCompleted = completed;
    toggleObjective(objective.id);
    if (!wasCompleted && onComplete) {
      onComplete();
    }
  }

  return (
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
          <h3
            className={`font-semibold text-sm sm:text-base transition-all ${completed ? "line-through text-muted-foreground" : ""}`}
          >
            {objective.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {objective.description}
          </p>

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
  );
}
