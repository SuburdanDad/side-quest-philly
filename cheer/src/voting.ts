// Fan voting: mostly positive and never a pile-on.
// - You can't vote for a team you're here to see (or ever followed at this meet).
// - Voting opens when a team takes the mat and closes shortly after.
// - Only the top Crowd Favorites are published. No bottom ranks, ever.

import { compareIds, MINUTE, RULES, SECOND } from "./rules.ts";
import { AWARDS, type Award, type Ballot, type FanProfile, type Meet, type Timestamp } from "./types.ts";

export const AWARD_LABELS: Record<Award, string> = {
  stunts: "Best Stunts",
  tumbling: "Best Tumbling",
  spirit: "Most Spirit",
  dance: "Best Dance",
};

export const OWN_TEAM_MESSAGE =
  "To keep it fair, you can't vote for your own team. We know you think they're perfect.";

export type BallotReason = "not-checked-in" | "own-team" | "window-closed" | "already-voted" | "invalid";

export interface BallotError {
  reason: BallotReason;
  message: string;
}

export const BALLOT_MESSAGES: Record<BallotReason, string> = {
  "not-checked-in": "Check in first so we know which squad is yours.",
  "own-team": OWN_TEAM_MESSAGE,
  "window-closed": "Voting opens when this team takes the mat and closes a few minutes after.",
  "already-voted": "You already cheered for this routine!",
  invalid: "Pick 1 to 5 stars.",
};

/** Last moment the server accepts a ballot: start + window + grace. */
export function ballotDeadline(start: Timestamp): Timestamp {
  return start + RULES.votingWindowMinutes * MINUTE + RULES.ballotGraceSeconds * SECOND;
}

export interface BallotContext {
  /** null until this device has checked in. */
  profile: FanProfile | null;
  /** Confirmed mat start for the ballot's team. */
  teamStartedAt: Timestamp | undefined;
  /** Ballots already accepted (any team). */
  existing: Ballot[];
}

/** Same checks, in the same order, as the cast_ballot RPC. */
export function validateBallot(
  ballot: Ballot,
  { profile, teamStartedAt, existing }: BallotContext,
): BallotError | null {
  const fail = (reason: BallotReason): BallotError => ({ reason, message: BALLOT_MESSAGES[reason] });
  if (!profile) return fail("not-checked-in");
  // everHomeTeamIds always contains homeTeamIds (applyCheckIn); checking both guards hand-built profiles.
  if (profile.everHomeTeamIds.includes(ballot.teamId) || profile.homeTeamIds.includes(ballot.teamId)) {
    return fail("own-team");
  }
  const inWindow =
    teamStartedAt !== undefined && ballot.castAt >= teamStartedAt && ballot.castAt <= ballotDeadline(teamStartedAt);
  if (!inWindow) return fail("window-closed");
  if (existing.some((b) => b.deviceId === ballot.deviceId && b.teamId === ballot.teamId)) {
    return fail("already-voted");
  }
  const validStars = Number.isInteger(ballot.stars) && ballot.stars >= 1 && ballot.stars <= 5;
  const validAwards =
    Array.isArray(ballot.awards) && ballot.awards.every((a) => (AWARDS as readonly string[]).includes(a));
  if (!validStars || !validAwards) return fail("invalid");
  return null;
}

/**
 * Check-in: "Which squad are you here to see?" homeTeamIds can change freely,
 * but everHomeTeamIds only grows, so un-follow → vote → re-follow can't sneak a
 * vote in. Newly following a team you already voted for removes that ballot.
 * (A fairness nudge, not a security boundary: a second browser defeats it.)
 */
export function applyCheckIn(
  prev: FanProfile | null,
  deviceId: string,
  nextHome: string[],
  myBallots: Ballot[],
): { profile: FanProfile; removedBallotTeamIds: string[] } {
  const homeTeamIds = [...new Set(nextHome)];
  const before = new Set([...(prev?.everHomeTeamIds ?? []), ...(prev?.homeTeamIds ?? [])]);
  const added = homeTeamIds.filter((id) => !before.has(id));
  const voted = new Set(myBallots.map((b) => b.teamId));
  return {
    profile: { deviceId, homeTeamIds, everHomeTeamIds: [...before, ...added] },
    removedBallotTeamIds: added.filter((id) => voted.has(id)).sort(compareIds),
  };
}

/** Too many teams, or a team that isn't on the running order (or is scratched). Mirrors check_in. */
export function checkInRejection(meet: Meet, nextHome: string[]): "too-many" | "unknown-team" | null {
  const ids = new Set(nextHome);
  if (ids.size > RULES.maxHomeTeams) return "too-many";
  const live = new Set(meet.slots.filter((s) => s.status !== "scratched").map((s) => s.teamId));
  for (const id of ids) if (!live.has(id)) return "unknown-team";
  return null;
}

export interface TeamTally {
  teamId: string;
  votes: number;
  /** Integer sum of stars; every comparison uses it, never a float average. */
  starSum: number;
  /** Raw mean (starSum / votes), for the team's own private recap. */
  averageStars: number;
  /** Bayesian-smoothed score (priorStarSum + starSum) / (priorVotes + votes), for display only. */
  rating: number;
  /** Ballots that gave this shout-out (each ballot counts once per award). */
  awards: Record<Award, number>;
}

/** Tallies per team. One ballot per identity per team: later duplicates are ignored. */
export function tally(ballots: Ballot[]): Map<string, TeamTally> {
  const out = new Map<string, TeamTally>();
  const seen = new Set<string>();
  for (const b of ballots) {
    const key = `${b.teamId}\n${b.deviceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let t = out.get(b.teamId);
    if (!t) {
      t = {
        teamId: b.teamId,
        votes: 0,
        starSum: 0,
        averageStars: 0,
        rating: 0,
        awards: Object.fromEntries(AWARDS.map((a) => [a, 0])) as Record<Award, number>,
      };
      out.set(b.teamId, t);
    }
    t.votes += 1;
    t.starSum += b.stars;
    for (const a of new Set(b.awards)) t.awards[a] += 1;
  }
  for (const t of out.values()) {
    t.averageStars = t.starSum / t.votes;
    t.rating = (RULES.priorStarSum + t.starSum) / (RULES.priorVotes + t.votes);
  }
  return out;
}

/**
 * Board order: exact smoothed rating compared by integer cross-multiplication
 * (so SQL and TS can't disagree on float rounding), then votes desc, then teamId.
 */
export function compareTallies(a: TeamTally, b: TeamTally): number {
  const { priorStarSum: ps, priorVotes: pv } = RULES;
  return (
    (ps + b.starSum) * (pv + a.votes) - (ps + a.starSum) * (pv + b.votes) ||
    b.votes - a.votes ||
    compareIds(a.teamId, b.teamId)
  );
}

/** Every team with at least minVotes, best first. Internal: never publish this whole list. */
export function rankTallies(tallies: Map<string, TeamTally>, minVotes: number = RULES.minVotes): TeamTally[] {
  return [...tallies.values()].filter((t) => t.votes >= minVotes).sort(compareTallies);
}

/** The public board: at most `top`, and never more than half the qualifying teams (no bottom ranks). */
export function crowdFavorites(
  tallies: Map<string, TeamTally>,
  { top = RULES.topN, minVotes = RULES.minVotes }: { top?: number; minVotes?: number } = {},
): TeamTally[] {
  const ranked = rankTallies(tallies, minVotes);
  return ranked.slice(0, Math.min(top, Math.floor(ranked.length / 2)));
}

/**
 * Winner of one shout-out ("Best Stunts") by share of voters, not raw count, so
 * big gyms don't win automatically. Ties: more votes, then teamId. undefined if nobody qualifies.
 */
export function awardWinner(
  tallies: Map<string, TeamTally>,
  award: Award,
  { minVotes = RULES.minVotes }: { minVotes?: number } = {},
): TeamTally | undefined {
  return [...tallies.values()]
    .filter((t) => t.votes >= minVotes && t.awards[award] > 0)
    .sort(
      (a, b) =>
        b.awards[award] * a.votes - a.awards[award] * b.votes ||
        b.votes - a.votes ||
        compareIds(a.teamId, b.teamId),
    )[0];
}
