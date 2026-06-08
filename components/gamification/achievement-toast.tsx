"use client";

import { useEffect, useState } from "react";
import type { Achievement } from "@/lib/gamification/types";
import { getAchievementById } from "@/lib/gamification/achievements";

const RARITY_STYLES = {
  common: {
    border: "border-[#CD7F32]",
    bg: "bg-[#CD7F32]/10",
    label: "text-[#CD7F32]",
    glow: "",
  },
  rare: {
    border: "border-[#C0C0C0]",
    bg: "bg-[#C0C0C0]/10",
    label: "text-[#888]",
    glow: "",
  },
  legendary: {
    border: "border-[#C9A84C]",
    bg: "bg-[#C9A84C]/10",
    label: "text-[#C9A84C]",
    glow: "shadow-[0_0_20px_rgba(201,168,76,0.3)]",
  },
} as const;

type AchievementToastProps = {
  achievementId: string;
  onDismiss: () => void;
};

function AchievementToastItem({ achievementId, onDismiss }: AchievementToastProps) {
  const [visible, setVisible] = useState(false);
  const achievement = getAchievementById(achievementId);

  useEffect(() => {
    // Slide in
    const showTimer = setTimeout(() => setVisible(true), 50);
    // Auto-dismiss after 4s
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // Wait for slide-out animation
    }, 4000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [onDismiss]);

  if (!achievement) return null;

  const style = RARITY_STYLES[achievement.rarity];

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}
      `}
    >
      <div
        className={`
          ${style.bg} ${style.border} ${style.glow}
          border-2 rounded-xl px-4 py-3
          bg-card backdrop-blur-sm
          flex items-center gap-3
          cursor-pointer
        `}
        onClick={() => {
          setVisible(false);
          setTimeout(onDismiss, 300);
        }}
      >
        <span className="text-2xl flex-shrink-0">{achievement.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-wider ${style.label}`}>
            {achievement.rarity} Achievement
          </p>
          <p className="text-sm font-black truncate">{achievement.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {achievement.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// Global toast manager — used via the event system
type QueuedToast = { id: string; achievementId: string };

export function AchievementToastContainer() {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ achievementId: string }>) => {
      const id = `${e.detail.achievementId}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, achievementId: e.detail.achievementId }]);
    };

    window.addEventListener(
      "achievement-unlocked" as string,
      handler as EventListener,
    );
    return () => {
      window.removeEventListener(
        "achievement-unlocked" as string,
        handler as EventListener,
      );
    };
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-lg mx-auto">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <AchievementToastItem
            achievementId={toast.achievementId}
            onDismiss={() => dismiss(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

// Helper to fire achievement toast from anywhere
export function fireAchievementToast(achievementId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("achievement-unlocked", {
      detail: { achievementId },
    }),
  );
}
