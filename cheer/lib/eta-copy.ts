// Pure copy decisions for ETAs, mat chips, the alert banner and home-card order.
// No React, no next/*: relative .ts imports so node:test loads it directly
// (test/eta-copy.test.ts). The math stays in src/; this file only decides words.

import { MINUTE } from "../src/rules.ts";
import type { MatBoard, RoutineRow } from "../src/board.ts";
import type { Eta } from "../src/schedule.ts";
import { driftLabel, driftTone, formatClock, formatCountdown } from "../src/format.ts";
import type { Timestamp } from "../src/types.ts";

/** Past its estimate by up to this much, an upcoming routine is "Any minute". */
export const ANY_MINUTE_MS = 5 * MINUTE;
/** Past this, the mat chip says when the last start was confirmed. */
export const STALE_ANCHOR_MS = 20 * MINUTE;

export type ChipTone = "late" | "go" | "muted";

/** The big ETA number: "12 min", then "Any minute" (0-5 min past), then "Running late · not tapped yet". */
export function etaCountdown(estimatedAt: Timestamp, now: Timestamp): { text: string; overdue: boolean } {
  const ms = estimatedAt - now;
  if (ms > 0) return { text: formatCountdown(ms), overdue: false };
  return { text: -ms <= ANY_MINUTE_MS ? "Any minute" : "Running late · not tapped yet", overdue: true };
}

/**
 * The mat's status chip. With no confirmed start yet the drift is meaningless
 * (it is 0 by definition), so say so instead of a green "On time".
 */
export function matChip(board: Pick<MatBoard, "confirmed" | "driftMinutes">): { label: string; tone: ChipTone } {
  if (!board.confirmed) return { label: "Not started yet", tone: "muted" };
  return { label: driftLabel(board.driftMinutes), tone: driftTone(board.driftMinutes) };
}

/** "Last confirmed h:mm" once the newest confirmed start is over 20 min old. */
export function staleAnchorLabel(
  lastConfirmedAt: Timestamp | undefined,
  now: Timestamp,
  timeZone: string,
): string | null {
  if (lastConfirmedAt === undefined || now - lastConfirmedAt <= STALE_ANCHOR_MS) return null;
  return `Last confirmed ${formatClock(lastConfirmedAt, timeZone)}`;
}

/** The pink heads-up banner. Never "in ~Now": a due or past estimate is "up any minute". */
export function alertText(
  teamName: string,
  mat: string,
  estimatedAt: Timestamp,
  now: Timestamp,
  timeZone: string,
): string {
  const at = formatClock(estimatedAt, timeZone);
  if (estimatedAt - now <= 0) return `${teamName} is up any minute on Mat ${mat} (est. ${at})`;
  return `${teamName} goes on in ~${formatCountdown(estimatedAt - now)} · Mat ${mat}, ${at}`;
}

/** My Team: the live countdowns first, finished teams below them. */
const HOME_RANK: Record<Eta["status"], number> = { "on-mat": 0, upcoming: 1, skipped: 2, done: 3, scratched: 4 };

export const homeOrder = (a: RoutineRow, b: RoutineRow): number =>
  HOME_RANK[a.eta.status] - HOME_RANK[b.eta.status] || a.eta.estimatedAt - b.eta.estimatedAt;
