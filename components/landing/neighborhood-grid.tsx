"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, MapPin } from "lucide-react";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { useQuestProgress } from "@/lib/hooks/use-quest-progress";
import { ProgressRing } from "@/components/quest/progress-ring";

export function NeighborhoodGrid() {
  const { getNeighborhoodProgress, progress } = useQuestProgress();
  const [expanded, setExpanded] = useState(false);

  const visibleNeighborhoods = expanded
    ? NEIGHBORHOODS
    : NEIGHBORHOODS.slice(0, 4);

  return (
    <div>
      <div className="space-y-2">
        {visibleNeighborhoods.map((n) => {
          const { done, total } = getNeighborhoodProgress(n.slug);
          const isComplete = progress.completedNeighborhoods.includes(n.id);

          return (
            <Link key={n.id} href={`/quest/${n.slug}`} className="block group">
              <div
                className={`flex items-center gap-3 rounded-xl border bg-card p-3 transition-all active:scale-[0.98] group-hover:shadow-md ${isComplete ? "ring-1 ring-[#C9A84C]/30 border-[#C9A84C]/20" : "group-hover:border-foreground/15"}`}
                style={{ borderLeftWidth: "3px", borderLeftColor: n.color }}
              >
                <div
                  className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-xl shadow-sm"
                  style={{ backgroundColor: n.color + "18" }}
                >
                  {n.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-[13px] truncate">{n.name}</p>
                    {isComplete && (
                      <span className="text-[9px] text-[#C9A84C] font-bold uppercase tracking-wide">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {n.tagline}
                  </p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  <ProgressRing
                    done={done}
                    total={total}
                    size={34}
                    strokeWidth={2.5}
                  />
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Expand/collapse toggle */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-muted-foreground/20 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <MapPin className="h-3.5 w-3.5" />
          <span className="text-[12px] font-semibold">
            Show all {NEIGHBORHOODS.length} neighborhoods
          </span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
      {expanded && NEIGHBORHOODS.length > 4 && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}
