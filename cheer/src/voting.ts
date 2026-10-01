// Fan voting: mostly positive and never a pile-on.
// - You can't vote for the team you're here to see.
// - Voting opens when a team takes the mat and closes shortly after.
// - Only the top Crowd Favorites are published. No bottom ranks, ever.

import { AWARDS, type Award, type Ballot, type FanProfile, type Minutes, type Timestamp } from "./types.ts";

const MINUTE = 60_000;

export const OWN_TEAM_MESSAGE =
  "To keep it fair, you can't vote for your own team. We know you think they're perfect.";

export type BallotError =
  | { reason: "own-team"; message: string }
  | { reason: "window-closed"; message: string }
  | { reason: "already-voted"; message: string }
  | { reason: "invalid"; message: string };

export interface BallotContext {
  profile: FanProfile;
  /** Confirmed mat start for the ballot's team (see schedule.confirmedStart). */
  teamStartedAt: Timestamp | undefined;
  /** Ballots already accepted (any team). */
  existing: Ballot[];
  /** How long after taking the mat voting stays open. */
  windowMinutes?: Minutes;
}

export function validateBallot(
  ballot: Ballot,
  { profile, teamStartedAt, existing, windowMinutes = 10 }: BallotContext,
): BallotError | null {
  if (profile.homeTeamIds.includes(ballot.teamId)) {
    return { reason: "own-team", message: OWN_TEAM_MESSAGE };
  }
  if (
    teamStartedAt === undefined ||
    ballot.castAt < teamStartedAt ||
    ballot.castAt > teamStartedAt + windowMinutes * MINUTE
  ) {
    return {
      reason: "window-closed",
      message: "Voting opens when this team takes the mat and closes a few minutes after.",
    };
  }
  if (existing.some((b) => b.deviceId === ballot.deviceId && b.teamId === ballot.teamId)) {
    return { reason: "already-voted", message: "You already cheered for this routine!" };
  }
  if (!Number.isInteger(ballot.stars) || ballot.stars < 1 || ballot.stars > 5) {
    return { reason: "invalid", message: "Pick 1 to 5 stars." };
  }
  if (ballot.awards.some((a) => !(AWARDS as readonly string[]).includes(a))) {
    return { reason: "invalid", message: "Unknown award." };
  }
  return null;
}

export interface TeamTally {
  teamId: string;
  votes: number;
  /** Raw mean, for the team's own private recap. */
  averageStars: number;
  /** Bayesian-smoothed score, so 3 votes of 5 stars can't beat 200 votes of 4.8. */
  rating: number;
  awards: Record<Award, number>;
}

export function tally(
  ballots: Ballot[],
  { priorVotes = 10, priorMean = 3.5 }: { priorVotes?: number; priorMean?: number } = {},
): Map<string, TeamTally> {
  const out = new Map<string, TeamTally>();
  for (const b of ballots) {
    let t = out.get(b.teamId);
    if (!t) {
      t = {
        teamId: b.teamId,
        votes: 0,
        averageStars: 0,
        rating: 0,
        awards: Object.fromEntries(AWARDS.map((a) => [a, 0])) as Record<Award, number>,
      };
      out.set(b.teamId, t);
    }
    t.averageStars = (t.averageStars * t.votes + b.stars) / (t.votes + 1);
    t.votes += 1;
    for (const a of new Set(b.awards)) t.awards[a] += 1;
  }
  for (const t of out.values()) {
    t.rating = (priorVotes * priorMean + t.averageStars * t.votes) / (priorVotes + t.votes);
  }
  return out;
}

/** The public board: top N only, with a minimum vote count to qualify. */
export function crowdFavorites(
  tallies: Map<string, TeamTally>,
  { top = 5, minVotes = 5 }: { top?: number; minVotes?: number } = {},
): TeamTally[] {
  return [...tallies.values()]
    .filter((t) => t.votes >= minVotes)
    .sort((a, b) => b.rating - a.rating || b.votes - a.votes)
    .slice(0, top);
}

/** Winner of one shout-out category ("Best Stunts"), or undefined if nobody qualifies. */
export function awardWinner(
  tallies: Map<string, TeamTally>,
  award: Award,
  { minVotes = 5 }: { minVotes?: number } = {},
): TeamTally | undefined {
  return [...tallies.values()]
    .filter((t) => t.votes >= minVotes && t.awards[award] > 0)
    .sort((a, b) => b.awards[award] / b.votes - a.awards[award] / a.votes)[0];
}
