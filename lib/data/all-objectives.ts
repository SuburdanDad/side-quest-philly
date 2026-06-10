import type { Objective } from "@/lib/types";
import { NEIGHBORHOODS } from "./neighborhoods";
import { TIMS_FAVORITES } from "./secret-quests";

export type ObjectiveContext = {
  objective: Objective;
  questId: string;
  questName: string;
};

/**
 * Every completable objective in the game: 45 neighborhood objectives
 * plus the 8 Tim's Favorites secret-quest objectives. This is the
 * single source of truth for XP math — the get_leaderboard() Postgres
 * function mirrors it, so keep them in sync.
 */
export const ALL_OBJECTIVES: Objective[] = [
  ...NEIGHBORHOODS.flatMap((n) => n.objectives),
  ...TIMS_FAVORITES.objectives,
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
]);

export function findObjective(id: string): ObjectiveContext | null {
  return LOOKUP.get(id) ?? null;
}
