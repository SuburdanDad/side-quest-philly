// A simulated arena crowd, so the demo feels live on a single phone.
// Everything is a pure function of (meet, time): no randomness at runtime,
// so the same moment always shows the same taps and ballots.
// It plays by the real rules (docs/backend-spec.md §2): each routine is tapped
// only once the previous one has been on the mat for minGapSeconds (routines
// here are >= 3 min apart), and every ballot lands inside the voting window.
// Crowd devices follow no teams, so none of their votes is an own-team vote.

import { MINUTE, RULES, SECOND } from "../rules.ts";
import { matOrder, usualGap } from "../schedule.ts";
import { AWARDS, type Award, type Ballot, type MatTap, type Meet, type Timestamp } from "../types.ts";

/** How many minutes each mat slips per routine (mat 1 runs late, mat 2 roughly on time). */
const SLIP_PER_ROUTINE: Record<string, number> = { "1": 1.6, "2": 0.4 };
const MIN_GAP = 3 * MINUTE;
/** Taps land 2, 6 and 10 s after the real start, so the confirmed start is real start + 6 s. */
const TAP_OFFSETS = [2, 6, 10].map((s) => s * SECOND);
const FIRST_VOTE = 45 * SECOND;
const VOTING_SPREAD = 8 * MINUTE;

/** Small deterministic PRNG seeded from a string. */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export interface CrowdPlan {
  /** When each team really takes the mat in the simulation. */
  actualStart: Map<string, Timestamp>;
  taps: MatTap[];
  ballots: Ballot[];
}

export function buildCrowdPlan(meet: Meet): CrowdPlan {
  const actualStart = new Map<string, Timestamp>();
  const taps: MatTap[] = [];
  const ballots: Ballot[] = [];

  for (const mat of meet.mats) {
    // Scratched teams never take the mat.
    const onMat = matOrder(meet, mat);
    const breakGap = usualGap(onMat) + RULES.breakExtraMinutes * MINUTE;
    let prev = -Infinity;
    let sinceBreak = 0;
    onMat.forEach((slot, i) => {
      // A scheduled break gives a late mat its time back: the slip starts over.
      if (i > 0 && slot.scheduledAt - onMat[i - 1].scheduledAt > breakGap) sinceBreak = 0;
      const r = rng(`start:${slot.teamId}`);
      const slip = (SLIP_PER_ROUTINE[mat] ?? 0.5) * sinceBreak + (r() - 0.5);
      const start = Math.max(slot.scheduledAt + Math.round(slip * MINUTE), prev + MIN_GAP);
      prev = start;
      sinceBreak += 1;
      actualStart.set(slot.teamId, start);

      // Three fans in the stands tap within a few seconds of each other.
      TAP_OFFSETS.forEach((offset, k) => {
        taps.push({ teamId: slot.teamId, deviceId: `crowd-${mat}-${k}`, at: start + offset });
      });

      // Fans vote over the first few minutes after the routine starts.
      const tr = rng(`team:${slot.teamId}`);
      const quality = 3.4 + tr() * 1.4; // 3.4 – 4.8 stars
      const signature: Award = AWARDS[Math.floor(tr() * AWARDS.length)];
      const voters = 18 + Math.floor(tr() * 70);
      for (let j = 0; j < voters; j++) {
        const vr = rng(`vote:${slot.teamId}:${j}`);
        const stars = Math.min(5, Math.max(1, Math.round(quality + (vr() - 0.5) * 2)));
        const awards = AWARDS.filter((a) => vr() < (a === signature ? 0.45 : 0.07));
        ballots.push({
          deviceId: `fan-${slot.teamId}-${j}`,
          teamId: slot.teamId,
          stars,
          awards,
          castAt: start + FIRST_VOTE + Math.floor(vr() * VOTING_SPREAD),
        });
      }
    });
  }

  taps.sort((a, b) => a.at - b.at);
  ballots.sort((a, b) => a.castAt - b.castAt);
  return { actualStart, taps, ballots };
}

/** What the crowd has done by `now`. */
export function crowdAt(plan: CrowdPlan, now: Timestamp): { taps: MatTap[]; ballots: Ballot[] } {
  return {
    taps: plan.taps.filter((t) => t.at <= now),
    ballots: plan.ballots.filter((b) => b.castAt <= now),
  };
}
