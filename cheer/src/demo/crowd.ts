// A simulated arena crowd, so the demo feels live on a single phone.
// Everything is a pure function of (meet, time): no randomness at runtime,
// so the same moment always shows the same taps and ballots.

import { AWARDS, type Award, type Ballot, type MatTap, type Meet, type Timestamp } from "../types.ts";

const MINUTE = 60_000;
const SECOND = 1_000;

/** How many minutes each mat slips per routine (mat 1 runs late, mat 2 roughly on time). */
const SLIP_PER_ROUTINE: Record<string, number> = { "1": 1.6, "2": 0.4 };
const MIN_GAP = 3 * MINUTE;
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
    const onMat = meet.slots
      .filter((s) => s.mat === mat)
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
    let prev = -Infinity;
    onMat.forEach((slot, i) => {
      const r = rng(`start:${slot.teamId}`);
      const slip = (SLIP_PER_ROUTINE[mat] ?? 0.5) * i + (r() - 0.5);
      const start = Math.max(slot.scheduledAt + Math.round(slip * MINUTE), prev + MIN_GAP);
      prev = start;
      actualStart.set(slot.teamId, start);

      // Three fans in the stands tap within a few seconds of each other.
      for (let k = 0; k < 3; k++) {
        taps.push({ teamId: slot.teamId, deviceId: `crowd-${mat}-${k}`, at: start + (2 + k * 4) * SECOND });
      }

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
          castAt: start + 45 * SECOND + Math.floor(vr() * VOTING_SPREAD),
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
