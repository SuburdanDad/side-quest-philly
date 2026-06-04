"use client";

import { Check } from "lucide-react";

type ProgressRingProps = {
  done: number;
  total: number;
  size?: number;
  strokeWidth?: number;
};

export function ProgressRing({
  done,
  total,
  size = 48,
  strokeWidth = 3,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? done / total : 0;
  const offset = circumference * (1 - progress);
  const isComplete = done === total && total > 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-500 ${isComplete ? "text-primary" : "text-primary/70"}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {isComplete ? (
          <Check className="h-4 w-4 text-primary" strokeWidth={3} />
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">
            {done}/{total}
          </span>
        )}
      </div>
    </div>
  );
}
