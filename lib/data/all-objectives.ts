import type { Objective } from "@/lib/types";
import { NEIGHBORHOODS } from "./neighborhoods";
import { TIMS_FAVORITES } from "./secret-quests";
import { CHAPTER_II, CHAPTER_II_QUEST_SUFFIX } from "./chapters";

export type ObjectiveContext = {
  objective: Objective;
  questId: string;
  questName: string;
};

/**
 * Every completable objective in the game: 45 core neighborhood
 * objectives + 8 Tim's Favorites + 45 Chapter II objectives. This is
 * the single source of truth for XP math — the get_leaderboard()
 * Postgres function mirrors it, so keep them in sync. Stamps remain
 * derived ONLY from NEIGHBORHOODS.objectives (the core 45).
 */
export const ALL_OBJECTIVES: Objective[] = [
  ...NEIGHBORHOODS.flatMap((n) => n.objectives),
  ...TIMS_FAVORITES.objectives,
  ...Object.values(CHAPTER_II).flat(),
];

const LOOKUP: Map<string, ObjectiveContext> = new Map([
  ...NEIGHBORHOODS.flatMap((n) =>
    n.objectives.map(
      (o): [string, ObjectiveContext] => [
        o.id,
        { objective: o, questId: n.id, questName: n.name },
      ],
    ),
  ),
  ...TIMS_FAVORITES.objectives.map(
    (o): [string, ObjectiveContext] => [
      o.id,
      {
        objective: o,
        questId: TIMS_FAVORITES.id,
        questName: TIMS_FAVORITES.name,
      },
    ],
  ),
  ...NEIGHBORHOODS.flatMap((n) =>
    (CHAPTER_II[n.id] ?? []).map(
      (o): [string, ObjectiveContext] => [
        o.id,
        {
          objective: o,
          questId: `${n.id}${CHAPTER_II_QUEST_SUFFIX}`,
          questName: `${n.name} — Chapter II`,
        },
      ],
    ),
  ),
]);

export function findObjective(id: string): ObjectiveContext | null {
  return LOOKUP.get(id) ?? null;
}
