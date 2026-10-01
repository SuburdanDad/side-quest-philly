// Shared by the parity suites (parity.test.ts, rpc-parity.test.ts): a seedable
// PRNG, an independent oracle for the spec's confirmedStart that also returns
// the confirming tap c and the counted taps (the TS keeps both internal, the
// SQL stores them as confirmed_at and confirmations), every boundary derived
// from RULES (so changing a constant on one side fails parity), and bulk
// loaders that put a domain Meet with its taps and ballots into the database
// as the superuser.

import { MINUTE, RULES, SECOND } from "../../src/rules.ts";
import type { Ballot, MatTap, Meet } from "../../src/types.ts";
import type { TestDb } from "./harness.ts";

export const CUTOFF = RULES.earlyTapMinutes * MINUTE;
export const CLUSTER = RULES.clusterSeconds * SECOND;
export const FREEZE = RULES.freezeSeconds * SECOND;
export const MAX_AGE = RULES.maxTapAgeSeconds * SECOND;
export const MIN_GAP = RULES.minGapSeconds * SECOND;
/** Rule 5: a crowd start stops taking taps once now > c + LATE_TAPS. */
export const LATE_TAPS = FREEZE + MAX_AGE;
/** A routine is closed once now > start + DEADLINE (window + grace). */
export const DEADLINE = RULES.votingWindowMinutes * MINUTE + RULES.ballotGraceSeconds * SECOND;
export const FALLBACK = RULES.revealFallbackMinutes * MINUTE;

/** mulberry32: small, seedable, deterministic. */
export function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const shuffle = <T>(r: () => number, xs: readonly T[]): T[] => [...xs].sort(() => r() - 0.5);

export interface Crowd {
  start: number;
  /** The confirming tap (routine_starts.confirmed_at). */
  c: number;
  /** Counted taps (routine_starts.confirmations). */
  n: number;
  /** First tap of the confirming cluster (t[i]); earlier taps are not counted. */
  from: number;
}

/** docs/backend-spec.md §2 "Confirmed start", step by step, over one tap time per identity. */
export function crowdOracle(times: number[], scheduledAt: number, minTaps: number): Crowd | undefined {
  const t = times.filter((x) => x >= scheduledAt - CUTOFF).sort((a, b) => a - b);
  for (let j = minTaps - 1; j < t.length; j++) {
    const i = j - minTaps + 1;
    if (t[j] - t[i] > CLUSTER) continue;
    const counted = t.filter((x) => x >= t[i] && x <= t[j] + FREEZE);
    const m = counted.length;
    const start = m % 2 ? counted[(m - 1) / 2] : Math.floor((counted[m / 2 - 1] + counted[m / 2] + 1) / 2);
    return { start, c: t[j], n: m, from: t[i] };
  }
  return undefined;
}

/** What `insert … on conflict do nothing` keeps: the first tap per (routine, identity) in array order. */
export function firstPerIdentity(taps: MatTap[]): MatTap[] {
  const seen = new Set<string>();
  return taps.filter((t) => {
    const key = `${t.teamId} ${t.deviceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The meet and its routines, exactly as the importer would store them. */
export async function insertMeet(db: TestDb, meet: Meet): Promise<void> {
  await db.sql(
    `insert into public.meets (id, name, time_zone, starts_at, mats, min_taps)
     values ($1, $2, $3, judgey_private.from_ms($4), $5, $6)`,
    [meet.id, meet.name, meet.timeZone, meet.startsAt, meet.mats, meet.minTaps ?? RULES.minTaps],
  );
  const team = new Map(meet.teams.map((t) => [t.id, t]));
  await db.sql(
    `insert into public.routines (meet_id, team_id, team_name, gym, division, mat, scheduled_at, status)
     select $1, x.team_id, x.team_id, 'Gym', x.division, x.mat, judgey_private.from_ms(x.at), x.status
     from unnest($2::text[], $3::text[], $4::text[], $5::bigint[], $6::text[]) x(team_id, division, mat, at, status)`,
    [
      meet.id,
      meet.slots.map((s) => s.teamId),
      meet.slots.map((s) => team.get(s.teamId)!.division),
      meet.slots.map((s) => s.mat),
      meet.slots.map((s) => s.scheduledAt),
      meet.slots.map((s) => s.status ?? "scheduled"),
    ],
  );
}

/** Taps in array order; a repeat (routine, identity) is dropped like tap_mat's `on conflict do nothing`. */
export async function insertTaps(db: TestDb, meetId: string, taps: MatTap[]): Promise<void> {
  await db.sql(
    `insert into public.taps (meet_id, team_id, user_id, at)
     select $1, x.team_id, x.user_id, judgey_private.from_ms(x.at)
     from unnest($2::text[], $3::uuid[], $4::bigint[]) with ordinality x(team_id, user_id, at, k)
     order by x.k
     on conflict do nothing`,
    [meetId, taps.map((t) => t.teamId), taps.map((t) => t.deviceId), taps.map((t) => t.at)],
  );
}

export async function recomputeAll(db: TestDb, meetId: string): Promise<void> {
  await db.sql("select judgey_private.recompute_start($1, r.team_id) from public.routines r where r.meet_id = $1", [
    meetId,
  ]);
}

/** Ballots plus team_tallies exactly as cast_ballot would have left them. */
export async function insertBallots(db: TestDb, meetId: string, ballots: Ballot[]): Promise<void> {
  await db.sql(
    `insert into public.ballots (meet_id, team_id, user_id, stars, awards, cast_at)
     select $1, x.team_id, x.user_id, x.stars, string_to_array(x.awards, ','), judgey_private.from_ms(x.at)
     from unnest($2::text[], $3::uuid[], $4::int[], $5::text[], $6::bigint[]) x(team_id, user_id, stars, awards, at)`,
    [
      meetId,
      ballots.map((b) => b.teamId),
      ballots.map((b) => b.deviceId),
      ballots.map((b) => b.stars),
      ballots.map((b) => b.awards.join(",")),
      ballots.map((b) => b.castAt),
    ],
  );
  await db.sql(
    `insert into judgey_private.team_tallies (meet_id, team_id, votes, star_sum, stunts, tumbling, spirit, dance)
     select meet_id, team_id, count(*), sum(stars),
            count(*) filter (where 'stunts' = any (awards)), count(*) filter (where 'tumbling' = any (awards)),
            count(*) filter (where 'spirit' = any (awards)), count(*) filter (where 'dance' = any (awards))
     from public.ballots where meet_id = $1 group by meet_id, team_id`,
    [meetId],
  );
}

/** The taps the database holds for a meet. */
export async function loadTaps(db: TestDb, meetId: string): Promise<MatTap[]> {
  const rows = await db.sql<{ team_id: string; user_id: string; at: number }>(
    "select team_id, user_id::text, judgey_private.ms(at) as at from public.taps where meet_id = $1",
    [meetId],
  );
  return rows.map((r) => ({ teamId: r.team_id, deviceId: r.user_id, at: r.at }));
}

export interface StartRow {
  started: number;
  confirmed: number | null;
  n: number;
  source: "crowd" | "operator";
}

/** routine_starts for a meet (scratched routines included). */
export async function loadStarts(db: TestDb, meetId: string): Promise<Map<string, StartRow>> {
  const rows = await db.sql<StartRow & { team_id: string }>(
    `select team_id, judgey_private.ms(started_at) as started, judgey_private.ms(confirmed_at) as confirmed,
            confirmations as n, source
     from public.routine_starts where meet_id = $1`,
    [meetId],
  );
  return new Map(rows.map(({ team_id, ...row }) => [team_id, row]));
}
