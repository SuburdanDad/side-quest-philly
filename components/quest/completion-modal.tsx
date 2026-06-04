"use client";

import { useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import type { Neighborhood } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type CompletionModalProps = {
  neighborhood: Neighborhood;
  open: boolean;
  onClose: () => void;
};

export function CompletionModal({
  neighborhood,
  open,
  onClose,
}: CompletionModalProps) {
  const fireConfetti = useCallback(() => {
    const colors = ["#004C54", "#E81828", "#006BB6", "#E8B931"];
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });
    }, 250);
  }, []);

  useEffect(() => {
    if (open) fireConfetti();
  }, [open, fireConfetti]);

  async function handleShare() {
    const text = `I just completed the ${neighborhood.name} Side Quest in Philadelphia! ${neighborhood.emoji} #SideQuestPhilly`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="text-center max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-4">
            <div className="animate-stamp inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-dashed" style={{ borderColor: neighborhood.color, color: neighborhood.color }}>
              <span className="text-4xl">{neighborhood.emoji}</span>
            </div>
          </div>
          <DialogTitle className="text-2xl">Quest Complete!</DialogTitle>
          <DialogDescription className="text-base">
            You conquered <strong>{neighborhood.name}</strong>! All 5
            objectives done. You&apos;ve earned your stamp.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-4">
          <Button onClick={handleShare}>Share Your Achievement</Button>
          <Button variant="outline" onClick={onClose}>
            Keep Exploring
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
