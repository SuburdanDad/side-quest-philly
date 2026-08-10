"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { QuestProgress } from "@/lib/types";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { ALL_OBJECTIVES } from "@/lib/data/all-objectives";
import { ULTIMATE_QUEST_IDS } from "@/lib/data/quests";

const STORAGE_KEY = "sqp_progress";

const DEFAULT_PROGRESS: QuestProgress = {
  completedObjectives: [],
  completedNeighborhoods: [],
  ultimateCompleted: false,
  firstVisit: "",
  lastActivity: "",
};

function getStoredProgress(): QuestProgress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    return JSON.parse(raw) as QuestProgress;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function setStoredProgress(progress: QuestProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

function computeDerived(completed: string[]) {
  const completedNeighborhoods = NEIGHBORHOODS.filter((n) =>
    n.objectives.every((o) => completed.includes(o.id)),
  ).map((n) => n.id);

  const ultimateCompleted = ULTIMATE_QUEST_IDS.every((uid) =>
    completed.includes(uid),
  );

  return { completedNeighborhoods, ultimateCompleted };
}

let cachedProgress = DEFAULT_PROGRESS;

function subscribe(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cachedProgress = getStoredProgress();
      callback();
    }
  };
  window.addEventListener("storage", handler);
  cachedProgress = getStoredProgress();
  return () => window.removeEventListener("storage", handler);
}

function getSnapshot() {
  return cachedProgress;
}

function getServerSnapshot() {
  return DEFAULT_PROGRESS;
}

export function useQuestProgress() {
  const progress = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggleObjective = useCallback((id: string) => {
    const current = getStoredProgress();
    const completed = current.completedObjectives.includes(id)
      ? current.completedObjectives.filter((o) => o !== id)
      : [...current.completedObjectives, id];

    const { completedNeighborhoods, ultimateCompleted } =
      computeDerived(completed);

    const now = new Date().toISOString();
    setStoredProgress({
      completedObjectives: completed,
      completedNeighborhoods,
      ultimateCompleted,
      firstVisit: current.firstVisit || now,
      lastActivity: now,
    });
  }, []);

  const isCompleted = useCallback(
    (id: string) => progress.completedObjectives.includes(id),
    [progress],
  );

  const getNeighborhoodProgress = useCallback(
    (slug: string) => {
      const neighborhood = NEIGHBORHOODS.find((n) => n.slug === slug);
      if (!neighborhood) return { done: 0, total: 0 };
      const done = neighborhood.objectives.filter((o) =>
        progress.completedObjectives.includes(o.id),
      ).length;
      return { done, total: neighborhood.objectives.length };
    },
    [progress],
  );

  const getOverallProgress = useCallback(() => {
    // Total spans everything completable (core + secret + chapters)
    // so "done" can never exceed it.
    return {
      done: progress.completedObjectives.length,
      total: ALL_OBJECTIVES.length,
    };
  }, [progress]);

  const resetAll = useCallback(() => {
    setStoredProgress({ ...DEFAULT_PROGRESS });
  }, []);

  return {
    progress,
    toggleObjective,
    isCompleted,
    getNeighborhoodProgress,
    getOverallProgress,
    resetAll,
  };
}
