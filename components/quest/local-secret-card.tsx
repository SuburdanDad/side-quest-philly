"use client";

import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import type { LocalSecret } from "@/lib/types";

type LocalSecretCardProps = {
  secret: LocalSecret;
  unlocked: boolean;
  neighborhoodColor: string;
};

export function LocalSecretCard({
  secret,
  unlocked,
  neighborhoodColor,
}: LocalSecretCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);

  useEffect(() => {
    if (unlocked && !revealed) {
      // Small delay for the reveal animation
      const timer = setTimeout(() => {
        setRevealed(true);
        setJustUnlocked(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [unlocked, revealed]);

  if (!unlocked) {
    return (
      <div className="mt-4 rounded-xl border-2 border-dashed border-muted-foreground/15 p-5 text-center">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
          <Lock className="h-4 w-4 text-muted-foreground/40" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50">
          Local Secret
        </p>
        <p className="text-[11px] text-muted-foreground/40 mt-1">
          Complete all 5 objectives to unlock a hidden gem
        </p>
      </div>
    );
  }

  return (
    <div
      className={`mt-4 rounded-xl border-2 p-5 transition-all duration-700 ${
        justUnlocked ? "animate-fade-up" : ""
      }`}
      style={{
        borderColor: `${neighborhoodColor}40`,
        backgroundColor: `${neighborhoodColor}08`,
      }}
    >
      {/* Shimmer overlay on first reveal */}
      {justUnlocked && (
        <div
          className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
          style={{
            background: `linear-gradient(105deg, transparent 40%, ${neighborhoodColor}15 45%, ${neighborhoodColor}25 50%, ${neighborhoodColor}15 55%, transparent 60%)`,
            animation: "shimmer 1.5s ease-in-out forwards",
          }}
        />
      )}

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{secret.emoji}</span>
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: neighborhoodColor }}
            >
              Local Secret Unlocked
            </p>
            <p className="font-bold text-sm">{secret.title}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {secret.description}
        </p>
      </div>
    </div>
  );
}
