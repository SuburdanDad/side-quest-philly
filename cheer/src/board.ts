// Everything a screen needs about the mats at one moment: running order with
// ETAs, who's on the mat, who's up next, which routines can be tapped, and
// which voting windows are open.

import { MINUTE, RULES } from "./rules.ts";
import {
  anchorOf,
  bySchedule,
  isScratched,
  matDrift,
  matEtas,
  roundMinutes,
  tapRejection,
  type Eta,
  type Starts,
} from "./schedule.ts";
import type { Meet, Slot, Team, Timestamp } from "./types.ts";

export interface RoutineRow {
  slot: Slot;
  team: Team;
  eta: Eta;
  /** Confirmed mat start (crowd or operator). Never set on a scratched routine. */
  startedAt?: Timestamp;
  /** The UI window [start, start + votingWindowMinutes]; the server adds a short grace. */
  votingOpen: boolean;
  votingClosesAt?: Timestamp;
  /** tapRejection(...) === null right now. */
  tappable: boolean;
}

export interface MatBoard {
  mat: string;
  driftMinutes: number;
  /** The anchor's start: lets the UI say "last confirmed 10:42" when it gets old. */
  lastConfirmedAt?: Timestamp;
  /** Every routine on the mat in scheduled order, scratched ones included. */
  rows: RoutineRow[];
  /** The on-mat routine that started last. */
  onMat?: RoutineRow;
  /** First upcoming routine: the one the "just took the mat" button is for. */
  upNext?: RoutineRow;
  /** Rows tappable right now, in scheduled order (may include the anchor, swaps and late teams). */
  tapCandidates: RoutineRow[];
}

export function buildBoards(meet: Meet, starts: Starts, now: Timestamp): MatBoard[] {
  const teams = new Map(meet.teams.map((t) => [t.id, t]));
  return meet.mats.map((mat) => {
    const etas = matEtas(meet, starts, mat, now);
    const rows: RoutineRow[] = meet.slots
      .filter((s) => s.mat === mat)
      .sort(bySchedule)
      .map((slot) => {
        const startedAt = isScratched(slot) ? undefined : starts.get(slot.teamId);
        const closesAt = startedAt === undefined ? undefined : startedAt + RULES.votingWindowMinutes * MINUTE;
        return {
          slot,
          team: teams.get(slot.teamId)!,
          eta: etas.get(slot.teamId)!,
          startedAt,
          votingOpen: startedAt !== undefined && now >= startedAt && now <= closesAt!,
          votingClosesAt: closesAt,
          tappable: tapRejection(meet, starts, slot.teamId, now) === null,
        };
      });
    const anchor = anchorOf(meet, starts, mat);
    const onMat = rows
      .filter((r) => r.eta.status === "on-mat")
      .reduce<RoutineRow | undefined>((best, r) => (best && best.startedAt! > r.startedAt! ? best : r), undefined);
    return {
      mat,
      driftMinutes: roundMinutes(matDrift(meet, starts, mat)),
      lastConfirmedAt: anchor && starts.get(anchor.teamId),
      rows,
      onMat,
      upNext: rows.find((r) => r.eta.status === "upcoming"),
      tapCandidates: rows.filter((r) => r.tappable),
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
