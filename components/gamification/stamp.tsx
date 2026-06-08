"use client";

import { useEffect, useState } from "react";

type StampProps = {
  emoji: string;
  name: string;
  color: string;
  completed: boolean;
  animateIn?: boolean;
};

export function Stamp({ emoji, name, color, completed, animateIn = false }: StampProps) {
  const [animated, setAnimated] = useState(!animateIn);

  useEffect(() => {
    if (animateIn && completed) {
      const timer = setTimeout(() => setAnimated(true), 100);
      return () => clearTimeout(timer);
    }
  }, [animateIn, completed]);

  if (!completed) {
    return (
      <div className="aspect-square rounded-xl border-2 border-dashed border-muted flex flex-col items-center justify-center gap-1 bg-muted/30">
        <span className="text-2xl grayscale opacity-30">{emoji}</span>
        <p className="text-[9px] font-bold text-muted-foreground/50 text-center px-1 leading-tight">
          {name}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`
        aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1
        transition-all duration-500
        ${animated ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-12 opacity-0"}
      `}
      style={{
        borderColor: color,
        backgroundColor: `${color}15`,
      }}
    >
      <span
        className={`
          text-3xl transition-transform duration-500
          ${animated ? "scale-100" : "scale-150"}
        `}
      >
        {emoji}
      </span>
      <p
        className="text-[9px] font-black text-center px-1 leading-tight uppercase tracking-wide"
        style={{ color }}
      >
        {name}
      </p>
    </div>
  );
}
