// Small pure builders and seeded generators shared by the domain tests and the
// DB parity tests (npm run test:db). Same seed, same data. Ids fit the SQL
// schema: team ids match ^[a-z0-9-]+$ and identities are lowercase UUIDs, so
// code-unit order (TS) and `collate "C"` / uuid order (SQL) agree.

import { rng } from "../src/demo/crowd.ts";
import { compareIds, MINUTE, SECOND } from "../src/rules.ts";
import { matOrder, type Starts } from "../src/schedule.ts";
import {
  AWARDS,
  type Award,
  type Ballot,
  type MatTap,
  type Meet,
  type RoutineStatus,
  type Slot,
  type Timestamp,
} from "../src/types.ts";

export const MIN = MINUTE;
export const SEC = SECOND;
/** Saturday Dec 5, 2026, 9:00 AM Eastern. */
export const T0 = Date.UTC(2026, 11, 5, 14, 0);

export const tap = (teamId: string, deviceId: string, at: Timestamp): MatTap => ({ teamId, deviceId, at });

export const ballot = (over: Partial<Ballot> = {}): Ballot => ({
  deviceId: "me",
  teamId: "rival",
  stars: 5,
  awards: [],
  castAt: T0,
  ...over,
});

/** One running-order row: [teamId, mat, minutes after T0, division?, status?]. */
export type Row = [teamId: string, mat: string, minute: number, division?: string, status?: RoutineStatus];

export function makeMeet(rows: Row[], extra: Partial<Meet> = {}): Meet {
  const slots: Slot[] = rows.map(([teamId, mat, minute, , status]) => ({
    teamId,
    mat,
    scheduledAt: T0 + minute * MIN,
    ...(status ? { status } : {}),
  }));
  return {
    id: "test-meet",
    name: "Test Meet",
    venue: "",
    city: "",
    timeZone: "America/New_York",
    startsAt: T0,
    mats: [...new Set(slots.map((s) => s.mat))],
    teams: rows.map(([id, , , division = "Open"]) => ({ id, name: id, gym: "Test Gym", division })),
    slots,
    ...extra,
  };
}

/** Starts from [teamId, minutes after T0] pairs. */
export const startsOf = (pairs: Array<[teamId: string, minute: number]>): Starts =>
  new Map(pairs.map(([id, minute]) => [id, T0 + Math.round(minute * MIN)]));

/** A deterministic lowercase v4-style UUID (valid Postgres uuid text). */
export function seededUuid(r: () => number): string {
  const h = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16));
  h[12] = "4";
  h[16] = "89ab"[Math.floor(r() * 4)];
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/**
 * Random taps on one routine, integer ms: early griefers around the 45-minute
 * cutoff, a real cluster near the (random) start, stragglers past the freeze,
 * exact ties, and an identity tapping twice. A repeat tap always comes later in
 * the array and later in time, so inserting in array order with
 * `on conflict do nothing` keeps the same tap confirmedStart keeps.
 */
export function randomTaps(seed: string, slot: Slot, { identities }: { identities?: number } = {}): MatTap[] {
  const r = rng(`taps:${seed}`);
  const n = identities ?? 1 + Math.floor(r() * 8);
  const spread = (r() < 0.5 ? 100 : 400) * SEC; // a tight crowd, or a scattered one
  const start = slot.scheduledAt + Math.round((r() - 0.3) * 30 * MIN);
  const taps: MatTap[] = [];
  for (let k = 0; k < n; k++) {
    const id = seededUuid(r);
    const kind = r();
    const at =
      kind < 0.15
        ? slot.scheduledAt - Math.round((40 + r() * 10) * MIN) // griefer near the cutoff
        : kind < 0.7
          ? start + Math.round(r() * spread) // the real cluster
          : start + Math.round(r() * 8 * MIN); // stragglers
    taps.push(tap(slot.teamId, id, at));
    if (r() < 0.15) taps.push(tap(slot.teamId, id, at + 1 + Math.round(r() * 60 * SEC)));
    if (r() < 0.15) taps.push(tap(slot.teamId, seededUuid(r), at)); // exact tie, another identity
  }
  return taps;
}

/**
 * Ballots for each team (at most one per identity per team), cast at `castAt`.
 * Some teams copy the previous team's ballots exactly, so exact rating ties
 * (then the votes and teamId tie-breaks) show up often.
 */
export function randomBallots(
  seed: string,
  teamIds: string[],
  { maxVoters = 24, castAt = T0 }: { maxVoters?: number; castAt?: Timestamp } = {},
): Ballot[] {
  const r = rng(`ballots:${seed}`);
  const out: Ballot[] = [];
  let prev: Array<{ stars: number; awards: Award[] }> = [];
  for (const teamId of teamIds) {
    const shape =
      prev.length > 0 && r() < 0.25
        ? prev
        : Array.from({ length: Math.floor(r() * (maxVoters + 1)) }, () => ({
            stars: 1 + Math.floor(r() * 5),
            awards: AWARDS.filter(() => r() < 0.2).sort(compareIds),
          }));
    for (const b of shape) out.push({ deviceId: seededUuid(r), teamId, stars: b.stars, awards: b.awards, castAt });
    prev = shape;
  }
  return out;
}

/**
 * A random meet: strictly increasing times per mat (mostly 4-minute gaps, now
 * and then a long break), divisions in blocks that can span mats, a few
 * scratches. minTaps stays at the default.
 */
export function randomMeet(
  seed: string,
  { startsAt = T0, mats = 2, routinesPerMat = 10, divisions = 3 } = {},
): Meet {
  const r = rng(`meet:${seed}`);
  const rows: Row[] = [];
  for (let m = 1; m <= mats; m++) {
    let minute = (m - 1) * 5;
    for (let i = 0; i < routinesPerMat; i++) {
      if (i > 0) minute += r() < 0.1 ? 25 + Math.floor(r() * 20) : 3 + Math.floor(r() * 3);
      const division = `div-${Math.floor((i * divisions) / routinesPerMat)}`;
      rows.push([`t${m}-${i}`, String(m), minute, division, r() < 0.08 ? "scratched" : undefined]);
    }
  }
  const meet = makeMeet(rows, { id: `random-${seed}`.toLowerCase().replace(/[^a-z0-9-]/g, "-") });
  const shift = startsAt - T0;
  return {
    ...meet,
    startsAt,
    slots: meet.slots.map((s) => ({ ...s, scheduledAt: s.scheduledAt + shift })),
  };
}

/**
 * Plausible starts as of `now`: each mat drifts like a random walk, most
 * routines that should have gone by now are confirmed, some are skipped.
 */
export function randomStarts(seed: string, meet: Meet, now: Timestamp): Starts {
  const r = rng(`starts:${seed}`);
  const starts: Starts = new Map();
  for (const mat of meet.mats) {
    let drift = 0;
    for (const slot of matOrder(meet, mat)) {
      drift += Math.round((r() - 0.35) * 3 * MIN);
      const at = slot.scheduledAt + drift;
      if (at > now) break;
      if (r() < 0.85) starts.set(slot.teamId, at + Math.floor(r() * SEC));
    }
  }
  return starts;
}
