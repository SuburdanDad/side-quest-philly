"use client";

import Link from "next/link";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { ProgressRing } from "@/components/quest/progress-ring";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function NeighborhoodGrid() {
  const { getNeighborhoodProgress, progress } = useQuestProgress();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {NEIGHBORHOODS.map((n, i) => {
        const { done, total } = getNeighborhoodProgress(n.slug);
        const isComplete = progress.completedNeighborhoods.includes(n.id);
        const hasStarted = done > 0;

        return (
          <Link key={n.id} href={`/quest/${n.slug}`} className="group">
            <Card
              className={`h-full transition-all duration-200 group-hover:shadow-lg group-hover:-translate-y-0.5 ${isComplete ? "ring-2 ring-primary/30" : ""}`}
              style={{ borderTopColor: n.color, borderTopWidth: "3px" }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardDescription className="flex items-center gap-1.5 text-xs">
                      <span className="text-lg">{n.emoji}</span>
                      {isComplete && (
                        <span className="text-primary font-medium">
                          Complete!
                        </span>
                      )}
                    </CardDescription>
                    <CardTitle className="text-xl mt-1">{n.name}</CardTitle>
                  </div>
                  <ProgressRing done={done} total={total} size={48} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic mb-3">
                  &ldquo;{n.tagline}&rdquo;
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {n.description}
                </p>
                <Button
                  variant={isComplete ? "outline" : "default"}
                  size="sm"
                  className="w-full"
                  tabIndex={-1}
                >
                  {isComplete
                    ? "View Quest"
                    : hasStarted
                      ? "Continue"
                      : "Start Quest"}
                </Button>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
