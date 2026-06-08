"use client";

import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { Stamp } from "./stamp";

export function PassportGrid() {
  const { progress } = useQuestProgress();

  return (
    <div className="grid grid-cols-3 gap-2">
      {NEIGHBORHOODS.map((n) => (
        <Stamp
          key={n.id}
          emoji={n.emoji}
          name={n.name}
          color={n.color}
          completed={progress.completedNeighborhoods.includes(n.id)}
        />
      ))}
    </div>
  );
}
