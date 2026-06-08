"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { GamificationState } from "@/lib/gamification/types";
import { checkAchievements } from "@/lib/gamification/achievements";
import { fireAchievementToast } from "@/components/gamification/achievement-toast";
import type { QuestProgress } from "@/lib/types";

const STORAGE_KEY = "sqp_gamification";

const DEFAULT_STATE: GamificationState = {
  xp: 0,
  achievements: [],
  achievementTimestamps: {},
  objectiveCompletedAt: {},
};

function getStoredState(): GamificationState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return JSON.parse(raw) as GamificationState;
  } catch {
    return DEFAULT_STATE;
  }
}

function setStoredState(state: GamificationState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

let cachedState = DEFAULT_STATE;

function subscribe(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cachedState = getStoredState();
      callback();
    }
  };
  window.addEventListener("storage", handler);
  cachedState = getStoredState();
  return () => window.removeEventListener("storage", handler);
}

function getSnapshot() {
  return cachedState;
}

function getServerSnapshot() {
  return DEFAULT_STATE;
}

export function useGamification() {
  const gamification = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const recordObjectiveCompletion = useCallback(
    (objectiveId: string, progress: QuestProgress) => {
      const current = getStoredState();
      const now = new Date().toISOString();

      // Record completion timestamp
      const objectiveCompletedAt = {
        ...current.objectiveCompletedAt,
        [objectiveId]: now,
      };

      // Check for new achievements
      const newAchievements = checkAchievements(
        progress,
        objectiveCompletedAt,
        current.achievements,
      );

      // Build updated timestamps
      const achievementTimestamps = { ...current.achievementTimestamps };
      for (const id of newAchievements) {
        achievementTimestamps[id] = now;
      }

      const updated: GamificationState = {
        ...current,
        achievements: [...current.achievements, ...newAchievements],
        achievementTimestamps,
        objectiveCompletedAt,
      };

      setStoredState(updated);

      // Fire toasts for new achievements
      for (const id of newAchievements) {
        // Stagger toasts slightly so they don't all appear at once
        setTimeout(
          () => fireAchievementToast(id),
          newAchievements.indexOf(id) * 600,
        );
      }

      return newAchievements;
    },
    [],
  );

  const removeObjectiveCompletion = useCallback((objectiveId: string) => {
    const current = getStoredState();
    const { [objectiveId]: _, ...remaining } = current.objectiveCompletedAt;
    setStoredState({
      ...current,
      objectiveCompletedAt: remaining,
    });
  }, []);

  return {
    gamification,
    recordObjectiveCompletion,
    removeObjectiveCompletion,
  };
}
