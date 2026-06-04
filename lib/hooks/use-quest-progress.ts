"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { QuestProgress } from "@/lib/types";
import { NEIGHBORHOODS } from "@/lib/data/neighborhoods";
import { ULTIMATE_QUEST_IDS } from "@/lib/data/quests";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

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
  const { user } = useAuth();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!user || syncedRef.current) return;
    syncedRef.current = true;

    const supabase = createClient();

    supabase
      .from("user_progress")
      .select("objective_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;

        const remoteIds = data.map((r) => r.objective_id);
        const localIds = getStoredProgress().completedObjectives;
        const merged = [...new Set([...localIds, ...remoteIds])];

        if (merged.length === localIds.length && merged.length === remoteIds.length) return;

        const newToRemote = merged.filter((id) => !remoteIds.includes(id));
        if (newToRemote.length > 0) {
          const rows = newToRemote.map((id) => ({
            user_id: user.id,
            objective_id: id,
          }));
          supabase.from("user_progress").upsert(rows, { onConflict: "user_id,objective_id" }).then(() => {});
        }

        const { completedNeighborhoods, ultimateCompleted } = computeDerived(merged);
        const now = new Date().toISOString();
        setStoredProgress({
          completedObjectives: merged,
          completedNeighborhoods,
          ultimateCompleted,
          firstVisit: getStoredProgress().firstVisit || now,
          lastActivity: now,
        });
      });
  }, [user]);

  const toggleObjective = useCallback(
    (id: string) => {
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

      if (user) {
        const supabase = createClient();
        if (completed.includes(id)) {
          supabase
            .from("user_progress")
            .upsert(
              { user_id: user.id, objective_id: id },
              { onConflict: "user_id,objective_id" },
            )
            .then(() => {});
        } else {
          supabase
            .from("user_progress")
            .delete()
            .eq("user_id", user.id)
            .eq("objective_id", id)
            .then(() => {});
        }
      }
    },
    [user],
  );

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
    const total = NEIGHBORHOODS.reduce(
      (sum, n) => sum + n.objectives.length,
      0,
    );
    return { done: progress.completedObjectives.length, total };
  }, [progress]);

  const resetAll = useCallback(() => {
    setStoredProgress({ ...DEFAULT_PROGRESS });
    if (user) {
      const supabase = createClient();
      supabase
        .from("user_progress")
        .delete()
        .eq("user_id", user.id)
        .then(() => {});
    }
  }, [user]);

  return {
    progress,
    toggleObjective,
    isCompleted,
    getNeighborhoodProgress,
    getOverallProgress,
    resetAll,
  };
}
