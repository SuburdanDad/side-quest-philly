// Everything a screen needs about the mats at one moment: running order with
// ETAs, who's on the mat, who's up next, and which voting windows are open.

import { confirmedStart, etaFor, matDrift, type ConfirmOptions, type Eta } from "./schedule.ts";
import type { MatTap, Meet, Slot, Team, Timestamp } from "./types.ts";

const MINUTE = 60_000;
export const VOTING_WINDOW_MINUTES = 10;

export interface RoutineRow {
  slot: Slot;
  team: Team;
  eta: Eta;
  /** Confirmed mat start, once the crowd agrees. */
  startedAt?: Timestamp;
  votingOpen: boolean;
  votingClosesAt?: Timestamp;
}

export interface MatBoard {
  mat: string;
  driftMinutes: number;
  rows: RoutineRow[];
  onMat?: RoutineRow;
  upNext?: RoutineRow;
}

export function buildBoards(
  meet: Meet,
  taps: MatTap[],
  now: Timestamp,
  opts?: ConfirmOptions,
): MatBoard[] {
  const teams = new Map(meet.teams.map((t) => [t.id, t]));
  return meet.mats.map((mat) => {
    const rows: RoutineRow[] = meet.slots
      .filter((s) => s.mat === mat)
      .sort((a, b) => a.scheduledAt - b.scheduledAt)
      .map((slot) => {
        const startedAt = confirmedStart(slot, taps, opts);
        const closesAt =
          startedAt === undefined ? undefined : startedAt + VOTING_WINDOW_MINUTES * MINUTE;
        return {
          slot,
          team: teams.get(slot.teamId)!,
          eta: etaFor(slot.teamId, meet.slots, taps, now, opts)!,
          startedAt,
          votingOpen: closesAt !== undefined && now >= startedAt! && now <= closesAt,
          votingClosesAt: closesAt,
        };
      });
    const onMat = rows.findLast((r) => r.eta.status === "on-mat");
    const upNext = rows.find((r) => r.eta.status === "upcoming");
    return {
      mat,
      driftMinutes: Math.round(matDrift(mat, meet.slots, taps, opts) / MINUTE),
      rows,
      onMat,
      upNext,
    };
  });
}

export function findRow(boards: MatBoard[], teamId: string): RoutineRow | undefined {
  for (const b of boards) {
    const row = b.rows.find((r) => r.team.id === teamId);
    if (row) return row;
  }
  return undefined;
}

/** Teams whose voting has closed: the only ones that count on the public board. */
export function closedTeamIds(boards: MatBoard[], now: Timestamp): Set<string> {
  const ids = new Set<string>();
  for (const b of boards) {
    for (const r of b.rows) {
      if (r.votingClosesAt !== undefined && now > r.votingClosesAt) ids.add(r.team.id);
    }
  }
  return ids;
}
