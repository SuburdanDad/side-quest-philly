// Crowd Favorites: what the public board shows, and when. A division's results
// land only after its routines are done, the board never shows more than half
// the qualifying teams, and each family's private recap hides small numbers.
// The SQL behind meet_snapshot.board mirrors this file (parity-tested).

import { compareIds, MINUTE, RULES } from "./rules.ts";
import { anchorIndex, isScratched, matOrder, type Starts } from "./schedule.ts";
import { AWARDS, type Award, type Ballot, type Meet, type Timestamp } from "./types.ts";
import { awardWinner, ballotDeadline, crowdFavorites, tally, type TeamTally } from "./voting.ts";

export interface BoardEntry {
  teamId: string;
  votes: number;
  /** Smoothed rating in tenths (4.2), rounded half-up with integers. */
  rating: number;
}

export interface MeetBoard {
  top: BoardEntry[];
  awards: Record<Award, string | null>;
  /** Sorted ascending in byte order (collate "C"). */
  revealedDivisions: string[];
  pendingDivisions: string[];
}

export interface Recap {
  teamId: string;
  /** Hidden (null) below recapMinVotes. */
  votes: number | null;
  /** Non-zero shout-out counts only. */
  awards: Partial<Record<Award, number>>;
  /** 1-based place on the shown board, or null. */
  rank: number | null;
}

/** Voting is over for good, grace included. */
export function isClosed(start: Timestamp | undefined, now: Timestamp): boolean {
  return start !== undefined && ballotDeadline(start) < now;
}

/**
 * A division is revealed once every non-scratched routine in it is closed, or
 * skipped with a later confirmed routine on its mat already closed; at the
 * latest revealFallbackMinutes after its last scheduled routine.
 */
export function divisionReveal(
  meet: Meet,
  starts: Starts,
  now: Timestamp,
): { revealed: string[]; pending: string[] } {
  // Routines that no longer hold their division back.
  const finished = new Set<string>();
  for (const mat of new Set(meet.slots.map((s) => s.mat))) {
    const order = matOrder(meet, mat);
    const a = anchorIndex(order, starts);
    let laterClosed = false;
    for (let k = order.length - 1; k >= 0; k--) {
      const start = starts.get(order[k].teamId);
      const closed = isClosed(start, now);
      if (closed || (start === undefined && k < a && laterClosed)) finished.add(order[k].teamId);
      laterClosed ||= closed;
    }
  }

  const divisionOf = new Map(meet.teams.map((t) => [t.id, t.division]));
  const byDivision = new Map<string, { last: Timestamp; done: boolean }>();
  for (const slot of meet.slots) {
    const division = divisionOf.get(slot.teamId);
    if (division === undefined) continue;
    const d = byDivision.get(division) ?? { last: slot.scheduledAt, done: true };
    d.last = Math.max(d.last, slot.scheduledAt);
    if (!isScratched(slot) && !finished.has(slot.teamId)) d.done = false;
    byDivision.set(division, d);
  }

  const revealed: string[] = [];
  const pending: string[] = [];
  for (const [division, d] of [...byDivision].sort(([a], [b]) => compareIds(a, b))) {
    const fallback = now > d.last + RULES.revealFallbackMinutes * MINUTE;
    (d.done || fallback ? revealed : pending).push(division);
  }
  return { revealed, pending };
}

/** floor((2·10·(35 + starSum) + (10 + votes)) / (2·(10 + votes))) / 10: tenths, half-up, no float drift. */
export function publishedRating({ votes, starSum }: Pick<TeamTally, "votes" | "starSum">): number {
  const n = 2 * 10 * (RULES.priorStarSum + starSum) + (RULES.priorVotes + votes);
  const d = 2 * (RULES.priorVotes + votes);
  return (n - (n % d)) / d / 10;
}

/** The public board: revealed divisions only, top min(topN, floor(qualifying / 2)), plus shout-out winners. */
export function computeBoard(meet: Meet, starts: Starts, ballots: Ballot[], now: Timestamp): MeetBoard {
  const { revealed, pending } = divisionReveal(meet, starts, now);
  const open = new Set(revealed);
  const shown = new Set(meet.teams.filter((t) => open.has(t.division)).map((t) => t.id));
  const tallies = tally(ballots.filter((b) => shown.has(b.teamId)));
  return {
    top: crowdFavorites(tallies).map((t) => ({ teamId: t.teamId, votes: t.votes, rating: publishedRating(t) })),
    awards: Object.fromEntries(AWARDS.map((a) => [a, awardWinner(tallies, a)?.teamId ?? null])) as Record<
      Award,
      string | null
    >,
    revealedDivisions: revealed,
    pendingDivisions: pending,
  };
}

/**
 * Private recaps for the teams this device follows right now (closed,
 * non-scratched routines only). Anyone can follow any team, so they're built to be harmless: no
 * averages, no small counts, no zeros.
 */
export function computeRecaps(
  meet: Meet,
  starts: Starts,
  ballots: Ballot[],
  homeTeamIds: string[],
  now: Timestamp,
  board: MeetBoard,
): Recap[] {
  const live = new Set(meet.slots.filter((s) => !isScratched(s)).map((s) => s.teamId));
  const ids = [...new Set(homeTeamIds)].filter((id) => live.has(id) && isClosed(starts.get(id), now));
  const wanted = new Set(ids);
  const tallies = tally(ballots.filter((b) => wanted.has(b.teamId)));
  return ids.map((teamId) => {
    const t = tallies.get(teamId);
    const votes = t?.votes ?? 0;
    const awards: Partial<Record<Award, number>> = {};
    for (const a of AWARDS) if (t && t.awards[a] > 0) awards[a] = t.awards[a];
    const place = board.top.findIndex((e) => e.teamId === teamId);
    return {
      teamId,
      votes: votes >= RULES.recapMinVotes ? votes : null,
      awards,
      rank: place < 0 ? null : place + 1,
    };
  });
}
