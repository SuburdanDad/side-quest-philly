// Parity: the SQL in supabase/migrations and the pure TS in src/ must agree
// exactly (docs/backend-spec.md §10). Seeded random meets in progress (1-3
// mats, exact schedule ties, breaks, swaps, no-shows, scratches, operator
// starts, griefers, stragglers, repeat and tied taps, ballots with exact
// rating ties, one-team divisions) go into the database as the superuser.
// Then, each against the real src/ code:
//   1. recompute_start ≡ confirmedStart, and confirmed_at / confirmations ≡ the
//      spec's confirming tap and counted taps (plus torture meets built with
//      test/fixtures.ts);
//   2. meet_snapshot (schedule, starts, board), my_state.recaps and tap_mat ≡
//      the TS at the database's serverNow;
//   3. board, division reveal and recaps ≡ computeBoard / computeRecaps swept
//      over the day, every closing and fallback boundary ±1 ms included;
//   4. the tap gate ≡ tapRejection (+ the server-only rule 5) swept over the
//      day, early-tap, min-gap and late-tap boundaries ±1 ms included.
// Boundaries come from RULES (test/db/parity-kit.ts), so changing a constant
// on one side only fails here. Each test also asserts that its fixtures hit the
// interesting paths. JUDGEY_PARITY_SEEDS (default 24) = meets per mode.

import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { computeBoard, computeRecaps, isClosed, type MeetBoard, type Recap } from "../../src/results.ts";
import { compareIds, MINUTE, RULES, SECOND } from "../../src/rules.ts";
import { anchorOf, confirmedStart, confirmedStarts, tapRejection, type Starts } from "../../src/schedule.ts";
import { AWARDS, type Ballot, type MatTap, type Meet, type Slot, type Team } from "../../src/types.ts";
import { compareTallies, rankTallies, tally } from "../../src/voting.ts";
import { randomMeet, randomTaps, seededUuid } from "../fixtures.ts";
import { begin, dbSuite, type TestDb } from "./harness.ts";
import {
  CLUSTER,
  crowdOracle,
  CUTOFF,
  DEADLINE,
  FALLBACK,
  firstPerIdentity,
  FREEZE,
  insertBallots,
  insertMeet,
  insertTaps,
  LATE_TAPS,
  loadStarts,
  loadTaps,
  MAX_AGE,
  MIN_GAP,
  prng,
  recomputeAll,
  shuffle,
  type StartRow,
} from "./parity-kit.ts";

const SEEDS = Number(process.env.JUDGEY_PARITY_SEEDS ?? 24);
// Case, punctuation and non-ASCII names: SQL `collate "C"` (UTF-8 bytes) and
// compareIds must agree, even for an emoji next to U+FF33.
const DIVISIONS = ["Youth 2", "junior 3", "Senior-4", "senior 4", "Open", "Mini 1", "Open 🏆", "Open Ｓ", "Élite 1"];
const PREFIXES = ["a", "a-b", "ab", "b", "z-1", "z1", "m"];
const UNKNOWN = "zz-not-a-team";

interface Fixture {
  meet: Meet;
  /** Taps in insertion order; a repeat by the same phone always comes later. */
  taps: MatTap[];
  operatorStarts: Map<string, number>;
  /** Home-team lists for recaps (duplicates, scratched and unknown ids included). */
  homes: string[][];
  r: () => number;
}

function makeFixture(seed: number, id: string, now: number): Fixture {
  const r = prng(seed * 104729 + 17);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

  const mats = Array.from({ length: int(1, 3) }, (_, i) => String(i + 1));
  const divisions = shuffle(r, DIVISIONS).slice(0, int(1, 5));
  const minTaps = r() < 0.6 ? 2 : r() < 0.6 ? 3 : int(4, 5);
  const teams: Team[] = [];
  const slots: Slot[] = [];
  const actual = new Map<string, number>();
  const used = new Set<string>();
  // Mostly meets in progress; every sixth one hasn't started yet (griefers only).
  const meetStart = seed % 6 === 0 ? now + int(46, 90) * MINUTE : now - int(20, 360) * MINUTE;

  for (const mat of mats) {
    let sched = meetStart + int(0, 20) * MINUTE;
    let real = sched + int(-2, 4) * MINUTE;
    const n = int(3, 12);
    for (let k = 0; k < n; k++) {
      let teamId = `${pick(PREFIXES)}-${int(1, 40)}`;
      while (used.has(teamId)) teamId = `${pick(PREFIXES)}-${int(1, 400)}`;
      used.add(teamId);
      teams.push({ id: teamId, name: teamId, gym: "Gym", division: pick(divisions) });
      const status = r() < 0.1 ? "scratched" : "scheduled";
      slots.push({ teamId, mat, scheduledAt: sched, status });
      // No-shows never go; a scratched team sometimes went on before it was scratched.
      const goes = status === "scheduled" ? r() > 0.08 : r() < 0.3;
      if (goes && real < now - 20 * SECOND) actual.set(teamId, real);
      // Next slot: a usual gap, an exact tie now and then, or a break.
      const gap = r() < 0.08 ? 0 : r() < 0.1 ? int(15, 40) * MINUTE : int(2, 5) * MINUTE + int(0, 59) * SECOND;
      sched += gap;
      real = Math.max(real + 2 * MINUTE + int(0, 120) * SECOND, sched + int(-3, 25) * MINUTE * (r() < 0.5 ? 1 : 0));
    }
  }
  // A one-team division now and then: on its own it never puts anyone on the board.
  if (r() < 0.5) pick(teams).division = "Solo";

  // Swaps: occasionally two neighbours on a mat go in the other order.
  for (const mat of mats) {
    const order = slots.filter((s) => s.mat === mat);
    for (let k = 0; k + 1 < order.length; k++) {
      const [x, y] = [actual.get(order[k].teamId), actual.get(order[k + 1].teamId)];
      if (x !== undefined && y !== undefined && r() < 0.12) {
        actual.set(order[k].teamId, y);
        actual.set(order[k + 1].teamId, x);
      }
    }
  }

  // Taps: clusters around the real start, stragglers, early griefers, lone
  // taps that never confirm, repeats, exact ties and exact rule boundaries.
  const people = Array.from({ length: 30 }, () => seededUuid(r));
  const taps: MatTap[] = [];
  const push = (teamId: string, deviceId: string, at: number) =>
    taps.push({ teamId, deviceId, at: Math.min(at, now - 1) });
  for (const slot of slots) {
    const start = actual.get(slot.teamId);
    for (const deviceId of shuffle(r, people).slice(0, int(0, 7))) {
      const kind = r();
      let at: number;
      if (start === undefined)
        at = slot.scheduledAt - int(0, 60) * MINUTE; // griefer / wrong team
      else if (kind < 0.65) at = start + int(-15, 40) * SECOND;
      else if (kind < 0.8)
        at = start + int(1, 6) * MINUTE; // late stragglers
      else if (kind < 0.9)
        at = start - int(1, 50) * MINUTE; // early griefers
      else at = start + int(-300, 300) * SECOND + int(0, 999);
      push(slot.teamId, deviceId, at);
      if (r() < 0.1) push(slot.teamId, deviceId, at + int(1, 90) * SECOND); // same phone again: ignored
      if (r() < 0.08) push(slot.teamId, seededUuid(r), at); // an exact tie from another phone
    }
    if (start !== undefined && r() < 0.15) {
      push(slot.teamId, seededUuid(r), slot.scheduledAt - CUTOFF); // counts
      push(slot.teamId, seededUuid(r), slot.scheduledAt - CUTOFF - 1); // ignored
    }
    if (start !== undefined && r() < 0.15) {
      const a = start - int(0, 60) * SECOND;
      push(slot.teamId, seededUuid(r), a);
      push(slot.teamId, seededUuid(r), a + CLUSTER + int(0, 1)); // exactly clusterSeconds apart, or 1 ms more
    }
  }
  // The freeze edge: c + freezeSeconds is counted, 1 ms later is not (later taps never move c).
  for (const slot of slots) {
    const times = firstPerIdentity(taps)
      .filter((t) => t.teamId === slot.teamId)
      .map((t) => t.at);
    const crowd = crowdOracle(times, slot.scheduledAt, minTaps);
    if (crowd && crowd.c + FREEZE + 1 < now && r() < 0.3) {
      push(slot.teamId, seededUuid(r), crowd.c + FREEZE);
      push(slot.teamId, seededUuid(r), crowd.c + FREEZE + 1);
    }
  }

  const operatorStarts = new Map<string, number>();
  for (const slot of slots) {
    const start = actual.get(slot.teamId);
    if (start !== undefined && r() < 0.1) operatorStarts.set(slot.teamId, start + int(-30, 30) * SECOND + int(0, 999));
  }

  const ids = slots.map((s) => s.teamId);
  const homes = Array.from({ length: 4 }, () => {
    const home = Array.from({ length: int(0, 4) }, () => (r() < 0.1 ? UNKNOWN : pick(ids)));
    if (home.length && r() < 0.3) home.push(home[0]);
    return home;
  });

  return {
    meet: {
      id,
      name: `Parity ${seed}`,
      venue: "",
      city: "",
      timeZone: "America/New_York",
      startsAt: meetStart,
      mats,
      teams,
      slots,
      minTaps,
    },
    taps,
    operatorStarts,
    homes,
    r,
  };
}

/**
 * Ballots for every routine with a start row (scratched ones too: voted, then
 * scratched), inside their window. Some teams copy the previous team's
 * ballots exactly (rating, votes and award ties) or match its exact rating
 * with more votes; some sit exactly on the minVotes and recapMinVotes boundaries.
 */
function makeBallots(r: () => number, starts: Map<string, number>): Ballot[] {
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const voters = Array.from({ length: 120 }, () => seededUuid(r));
  const ballots: Ballot[] = [];
  let prev: Array<Pick<Ballot, "stars" | "awards">> = [];
  for (const [teamId, start] of [...starts].sort(([a], [b]) => compareIds(a, b))) {
    const lean = 1 + r() * 4;
    const fresh = (n: number) =>
      Array.from({ length: n }, () => ({
        stars: Math.min(5, Math.max(1, Math.round(lean + (r() - 0.5) * 2.5))),
        awards: AWARDS.filter(() => r() < 0.25),
      }));
    const kind = r();
    // Twice the previous ballots plus ten at the prior's 3.5 average: the exact
    // same rating with more votes, so the votes tie-break decides.
    const priorTen = [4, 3, 4, 3, 4, 3, 4, 3, 4, 3].map((stars) => ({ stars, awards: [] }));
    const shape =
      prev.length && kind < 0.15
        ? prev
        : prev.length && prev.length <= 50 && kind < 0.25
          ? [...prev, ...prev, ...priorTen]
          : kind < 0.35
            ? fresh(RULES.minVotes - 1 + int(0, 1))
            : kind < 0.45
              ? fresh(RULES.recapMinVotes - 1 + int(0, 1))
              : fresh(Math.floor(r() * r() * 26));
    shuffle(r, voters)
      .slice(0, shape.length)
      .forEach((deviceId, k) => ballots.push({ deviceId, teamId, ...shape[k], castAt: start + int(0, DEADLINE) }));
    prev = shape;
  }
  return ballots;
}

/** One fixture as both sides see it. */
interface Loaded {
  label: string;
  meet: Meet;
  raw: MatTap[];
  stored: MatTap[];
  /** routine_starts before / after the operator corrections. */
  crowdRows: Map<string, StartRow>;
  rows: Map<string, StartRow>;
  /** Effective starts as the client sees them: crowd, overridden by operator, never scratched. */
  starts: Starts;
  operator: Set<string>;
  operatorStarts: Map<string, number>;
  /** The confirming tap c of each crowd start (rule 5). */
  crowdC: Map<string, number>;
  ballots: Ballot[];
  homes: string[][];
  now: number;
  r: () => number;
}

async function load(db: TestDb, seed: number, label: string): Promise<Loaded> {
  const now = await db.nowMs();
  const f = makeFixture(seed, db.meetId("parity"), now);
  const { meet } = f;
  await insertMeet(db, meet);
  await insertTaps(db, meet.id, f.taps);
  await recomputeAll(db, meet.id);
  const crowdRows = await loadStarts(db, meet.id);
  // Operator corrections override crowd rows; a second recompute must not touch them.
  for (const [teamId, at] of f.operatorStarts) {
    await db.sql(
      `insert into public.routine_starts (meet_id, team_id, started_at, source)
       values ($1, $2, judgey_private.from_ms($3), 'operator')
       on conflict (meet_id, team_id) do update set started_at = excluded.started_at, source = 'operator',
         confirmed_at = null, confirmations = 0`,
      [meet.id, teamId, at],
    );
  }
  await recomputeAll(db, meet.id);
  const rows = await loadStarts(db, meet.id);
  const stored = await loadTaps(db, meet.id);

  const minTaps = meet.minTaps ?? RULES.minTaps;
  const starts = confirmedStarts(meet, stored);
  const operator = new Set<string>();
  const crowdC = new Map<string, number>();
  for (const slot of meet.slots) {
    if (slot.status === "scratched") continue;
    const at = f.operatorStarts.get(slot.teamId);
    if (at !== undefined) {
      starts.set(slot.teamId, at);
      operator.add(slot.teamId);
      continue;
    }
    const times = stored.filter((t) => t.teamId === slot.teamId).map((t) => t.at);
    const crowd = crowdOracle(times, slot.scheduledAt, minTaps);
    if (crowd) crowdC.set(slot.teamId, crowd.c);
  }
  const ballots = makeBallots(f.r, new Map([...rows].map(([teamId, row]) => [teamId, row.started])));
  await insertBallots(db, meet.id, ballots);
  return {
    label,
    meet,
    raw: f.taps,
    stored,
    crowdRows,
    rows,
    starts,
    operator,
    operatorStarts: f.operatorStarts,
    crowdC,
    ballots,
    homes: f.homes,
    now,
    r: f.r,
  };
}

/** tapRejection at the tap time, plus rule 5 at server time (operator starts are final). */
function expectedTap(l: Loaded, teamId: string, at: number, now: number): string | null {
  const reason = tapRejection(l.meet, l.starts, teamId, at);
  if (reason !== null || !l.starts.has(teamId)) return reason;
  return l.operator.has(teamId) || now > l.crowdC.get(teamId)! + LATE_TAPS ? "already-confirmed" : null;
}

/** What tap_mat says right now for a brand-new identity, rolled back so nothing changes. */
async function probeTap(db: TestDb, meetId: string, teamId: string, who: string) {
  const c = await db.connect();
  try {
    await begin(c, who);
    const { rows } = await c.query(
      `select public.tap_mat(p_meet => $1, p_team => $2, p_age_ms => 0) as r,
              (extract(epoch from date_trunc('milliseconds', now())) * 1000)::bigint as now`,
      [meetId, teamId],
    );
    return rows[0] as { r: { ok: boolean; reason?: string; confirmed: boolean; startedAt?: number }; now: number };
  } finally {
    await c.query("rollback");
    c.release();
  }
}

const sortTaps = (taps: MatTap[]) =>
  [...taps].sort((a, b) => compareIds(a.teamId, b.teamId) || compareIds(a.deviceId, b.deviceId));

dbSuite("parity with src/", (ctx) => {
  const loaded: Loaded[] = [];
  before(async () => {
    const salt = ctx.mode === "legacy" ? 7919 : 0;
    for (let seed = 1; seed <= SEEDS; seed++)
      loaded.push(await load(ctx.db, seed + salt, `seed ${seed} (${ctx.mode})`));
  });

  test("recompute_start ≡ confirmedStart: start, confirming tap and counted taps, outliers included", async (t) => {
    const { db } = ctx;
    const seen = {
      routinesWithTaps: 0,
      taps: 0,
      confirmed: 0,
      clusteredNever: 0,
      tooEarly: 0,
      beforeCluster: 0,
      afterFreeze: 0,
      repeats: 0,
      ties: 0,
      evenMedian: 0,
      minTaps: new Set<number>(),
    };
    const check = (label: string, meet: Meet, raw: MatTap[], stored: MatTap[], rows: Map<string, StartRow>) => {
      // The database keeps one tap per identity: the first one (tap_mat retries are no-ops).
      assert.deepEqual(sortTaps(stored), sortTaps(firstPerIdentity(raw)), `${label}: stored taps`);
      seen.repeats += raw.length - stored.length;
      const minTaps = meet.minTaps ?? RULES.minTaps;
      seen.minTaps.add(minTaps);
      for (const slot of meet.slots) {
        const times = stored.filter((t) => t.teamId === slot.teamId).map((t) => t.at);
        const crowd = crowdOracle(times, slot.scheduledAt, minTaps);
        assert.equal(
          confirmedStart(slot, stored, minTaps),
          crowd?.start,
          `${label}: TS confirmedStart of ${slot.teamId}`,
        );
        assert.deepEqual(
          rows.get(slot.teamId),
          crowd && { started: crowd.start, confirmed: crowd.c, n: crowd.n, source: "crowd" },
          `${label}: routine_starts of ${slot.teamId}`,
        );
        if (times.length === 0) continue;
        seen.routinesWithTaps++;
        seen.taps += times.length;
        seen.ties += times.length - new Set(times).size;
        const valid = times.filter((t) => t >= slot.scheduledAt - CUTOFF);
        seen.tooEarly += times.length - valid.length;
        if (!crowd) {
          if (valid.length >= minTaps) seen.clusteredNever++;
          continue;
        }
        seen.confirmed++;
        if (crowd.n % 2 === 0) seen.evenMedian++;
        seen.beforeCluster += valid.filter((t) => t < crowd.from).length;
        seen.afterFreeze += valid.filter((t) => t > crowd.c + FREEZE).length;
      }
    };

    for (const l of loaded) check(l.label, l.meet, l.raw, l.stored, l.crowdRows);

    // Torture meets from test/fixtures.ts: scattered crowds, griefers right at the
    // cutoff, stragglers, repeats and exact ties, minTaps 2-5.
    for (let k = 0; k < Math.ceil(SEEDS / 2); k++) {
      const seed = `${ctx.mode}-${k}`;
      const base = randomMeet(seed, { mats: 1 + (k % 3), routinesPerMat: 6 + (k % 7), divisions: 2 });
      const meet: Meet = { ...base, id: db.meetId("torture"), minTaps: 2 + (k % 4) };
      const raw = meet.slots.flatMap((s) => randomTaps(`${seed}:${s.teamId}`, s));
      await insertMeet(db, meet);
      await insertTaps(db, meet.id, raw);
      await recomputeAll(db, meet.id);
      check(`torture ${seed}`, meet, raw, await loadTaps(db, meet.id), await loadStarts(db, meet.id));
    }

    const summary = JSON.stringify({ ...seen, minTaps: [...seen.minTaps] });
    t.diagnostic(`coverage ${summary}`);
    if (SEEDS >= 24) assert.ok(seen.routinesWithTaps >= 200, `at least 200 routines' worth of taps: ${summary}`);
    for (const [key, n] of Object.entries(seen)) {
      if (typeof n === "number") assert.ok(n > 0, `fixtures exercise ${key}: ${summary}`);
    }
    assert.ok(seen.minTaps.size >= 3, `several minTaps values: ${summary}`);
  });

  test("meet_snapshot, my_state.recaps and tap_mat ≡ the TS at serverNow", async () => {
    const { db } = ctx;
    const reasons = new Set<string>();
    for (const l of loaded) {
      const { meet, label } = l;
      // A second recompute left the operator rows and every crowd row alone.
      const expectedRows = new Map(l.crowdRows);
      for (const [teamId, at] of l.operatorStarts) {
        expectedRows.set(teamId, { started: at, confirmed: null, n: 0, source: "operator" });
      }
      assert.deepEqual(l.rows, expectedRows, `${label}: routine_starts after operator corrections`);

      const snap = await db.rpc("anon", "meet_snapshot", { p_meet: meet.id, p_have_version: 0 });
      const team = new Map(meet.teams.map((t) => [t.id, t]));
      assert.deepEqual(
        snap.schedule,
        {
          meet: {
            id: meet.id,
            name: meet.name,
            venue: "",
            city: "",
            timeZone: meet.timeZone,
            startsAt: meet.startsAt,
            mats: meet.mats,
            minTaps: meet.minTaps,
          },
          routines: [...meet.slots]
            .sort((a, b) => a.scheduledAt - b.scheduledAt || compareIds(a.mat, b.mat) || compareIds(a.teamId, b.teamId))
            .map((s) => ({
              teamId: s.teamId,
              teamName: s.teamId,
              gym: "Gym",
              division: team.get(s.teamId)!.division,
              mat: s.mat,
              scheduledAt: s.scheduledAt,
              status: s.status ?? "scheduled",
            })),
        },
        `${label}: schedule`,
      );
      assert.deepEqual(
        snap.starts,
        [...l.starts]
          .sort(([a], [b]) => compareIds(a, b))
          .map(([teamId, startedAt]) => ({ teamId, startedAt, source: l.operator.has(teamId) ? "operator" : "crowd" })),
        `${label}: snapshot starts`,
      );
      assert.deepEqual(snap.board, computeBoard(meet, l.starts, l.ballots, snap.serverNow), `${label}: board`);

      for (const home of l.homes) {
        const fan = randomUUID();
        await db.sql(
          "insert into public.fans (meet_id, user_id, home_team_ids, ever_home_team_ids) values ($1, $2, $3, $3)",
          [meet.id, fan, home],
        );
        const state = await db.rpc(fan, "my_state", { p_meet: meet.id });
        const board = computeBoard(meet, l.starts, l.ballots, state.serverNow);
        assert.deepEqual(
          state.recaps,
          computeRecaps(meet, l.starts, l.ballots, home, state.serverNow, board),
          `${label}: recaps for ${JSON.stringify(home)}`,
        );
      }

      // tap_mat for a new identity on every routine (rolled back), response included.
      for (const teamId of [...meet.slots.map((s) => s.teamId), UNKNOWN]) {
        const who = randomUUID();
        const { r, now } = await probeTap(db, meet.id, teamId, who);
        const reason = expectedTap(l, teamId, now, now);
        reasons.add(reason ?? "ok");
        let start = l.starts.get(teamId);
        if (reason === null) {
          const slot = meet.slots.find((s) => s.teamId === teamId)!;
          start = confirmedStart(slot, [...l.stored, { teamId, deviceId: who, at: now }], meet.minTaps);
        }
        const expected: Record<string, unknown> = { ok: reason === null, confirmed: start !== undefined };
        if (reason !== null) expected.reason = reason;
        if (start !== undefined) expected.startedAt = start;
        assert.deepEqual(r, expected, `${label}: tap_mat ${teamId} at ${now}`);
      }
    }
    for (const reason of ["ok", "unknown-team", "scratched", "too-early", "not-next", "already-confirmed"]) {
      assert.ok(reasons.has(reason), `tap_mat reason ${reason} exercised (${[...reasons]})`);
    }
  });

  test("board, division reveal and recaps ≡ the TS swept over the day, boundaries ±1 ms", async (t) => {
    const { db } = ctx;
    const seen = {
      instants: 0,
      shownTeams: 0,
      pending: 0,
      revealedAllClosed: 0,
      revealedPastSkipped: 0,
      revealedByFallback: 0,
      halfRuleCut: 0,
      oddQualifying: 0,
      loneQualifier: 0,
      topNCut: 0,
      votesTieBreaks: 0,
      idTieBreaks: 0,
      awardWinners: 0,
      noAwardWinner: 0,
      awardShareTies: 0,
      scratchedVotesCounted: 0,
      smallDivisions: 0,
      recapHidden: 0,
      recapShown: 0,
      recapRanked: 0,
      recapAwards: 0,
    };
    for (const l of loaded) {
      const { meet, label } = l;
      const division = new Map(meet.teams.map((t) => [t.id, t.division]));
      const lastOf = new Map<string, number>();
      const sizeOf = new Map<string, number>();
      for (const s of meet.slots) {
        const d = division.get(s.teamId)!;
        lastOf.set(d, Math.max(lastOf.get(d) ?? -Infinity, s.scheduledAt));
        sizeOf.set(d, (sizeOf.get(d) ?? 0) + 1);
      }
      seen.smallDivisions += [...sizeOf.values()].filter((n) => n === 1).length;

      const instants = new Set<number>([l.now]);
      for (const row of l.rows.values()) {
        instants.add(row.started + DEADLINE);
        instants.add(row.started + DEADLINE + 1);
      }
      for (const last of lastOf.values()) {
        instants.add(last + FALLBACK);
        instants.add(last + FALLBACK + 1);
      }
      const from = meet.startsAt - 30 * MINUTE;
      for (let k = 0; k < 8; k++) instants.add(from + Math.floor(l.r() * (l.now + 240 * MINUTE - from)));
      const ts = [...instants];

      const boards = await db.sql<{ b: MeetBoard }>(
        `select judgey_private.board($1, x.t) as b from unnest($2::bigint[]) with ordinality x(t, k) order by x.k`,
        [meet.id, ts],
      );
      const recaps = await Promise.all(
        l.homes.map((home) =>
          db.sql<{ r: Recap[] }>(
            `select judgey_private.recaps($1, $3::text[], x.t, judgey_private.board($1, x.t)) as r
             from unnest($2::bigint[]) with ordinality x(t, k) order by x.k`,
            [meet.id, ts, home],
          ),
        ),
      );

      ts.forEach((t, k) => {
        const board = computeBoard(meet, l.starts, l.ballots, t);
        assert.deepEqual(boards[k].b, board, `${label}: board at ${t}`);
        l.homes.forEach((home, h) =>
          assert.deepEqual(
            recaps[h][k].r,
            computeRecaps(meet, l.starts, l.ballots, home, t, board),
            `${label}: recaps for ${JSON.stringify(home)} at ${t}`,
          ),
        );

        // What this instant exercised (both sides agree, so counting one is enough).
        seen.instants++;
        seen.shownTeams += board.top.length;
        seen.pending += board.pendingDivisions.length;
        for (const d of board.revealedDivisions) {
          const live = meet.slots.filter((s) => division.get(s.teamId) === d && s.status !== "scratched");
          const fallback = t > lastOf.get(d)! + FALLBACK;
          if (live.every((s) => isClosed(l.starts.get(s.teamId), t))) seen.revealedAllClosed++;
          else if (!fallback) seen.revealedPastSkipped++;
          else seen.revealedByFallback++;
        }
        const revealed = new Set(board.revealedDivisions);
        const shown = l.ballots.filter((b) => revealed.has(division.get(b.teamId)!));
        const scratched = new Set(meet.slots.filter((s) => s.status === "scratched").map((s) => s.teamId));
        if (shown.some((b) => scratched.has(b.teamId))) seen.scratchedVotesCounted++;
        const tallies = tally(shown);
        const ranked = rankTallies(tallies);
        const q = ranked.length;
        if (q > 0 && q < 2 * RULES.topN) seen.halfRuleCut++;
        if (q % 2 === 1) seen.oddQualifying++;
        if (q === 1) seen.loneQualifier++;
        if (q > 2 * RULES.topN) seen.topNCut++;
        for (let i = 0; i + 1 < ranked.length && i < board.top.length; i++) {
          const [a, b] = [ranked[i], ranked[i + 1]];
          const { priorStarSum: ps, priorVotes: pv } = RULES;
          const sameRating = (ps + a.starSum) * (pv + b.votes) === (ps + b.starSum) * (pv + a.votes);
          if (sameRating && a.votes !== b.votes) seen.votesTieBreaks++;
          if (sameRating && a.votes === b.votes) seen.idTieBreaks++;
          assert.ok(compareTallies(a, b) < 0);
        }
        for (const award of AWARDS) {
          if (board.awards[award] === null) seen.noAwardWinner++;
          else seen.awardWinners++;
          const withAward = ranked.filter((x) => x.awards[award] > 0);
          for (let i = 0; i < withAward.length; i++) {
            for (let j = i + 1; j < withAward.length; j++) {
              const [a, b] = [withAward[i], withAward[j]];
              if (a.awards[award] * b.votes === b.awards[award] * a.votes) seen.awardShareTies++;
            }
          }
        }
        for (const home of l.homes) {
          for (const recap of computeRecaps(meet, l.starts, l.ballots, home, t, board)) {
            if (recap.votes === null) seen.recapHidden++;
            else seen.recapShown++;
            if (recap.rank !== null) seen.recapRanked++;
            if (Object.keys(recap.awards).length) seen.recapAwards++;
          }
        }
      });
    }
    const summary = JSON.stringify(seen);
    t.diagnostic(`coverage ${summary}`);
    for (const [key, n] of Object.entries(seen)) assert.ok(n > 0, `fixtures exercise ${key}: ${summary}`);
    assert.ok(loaded.length >= 3, "at least three meets' worth of ballots");
  });

  test("tap gate ≡ tapRejection + rule 5, swept over the day, boundaries ±1 ms", async (t) => {
    const { db } = ctx;
    const reasons = new Map<string, number>();
    for (const l of loaded) {
      const { meet, label } = l;
      const probes: Array<[team: string, at: number, now: number]> = [];
      const from = meet.startsAt - 60 * MINUTE;
      for (const teamId of [...meet.slots.map((s) => s.teamId), UNKNOWN]) {
        const slot = meet.slots.find((s) => s.teamId === teamId);
        for (let k = 0; k < 4; k++) {
          const now = from + Math.floor(l.r() * (l.now + 90 * MINUTE - from));
          probes.push([teamId, now - Math.floor(l.r() * (MAX_AGE + 1)), now]);
        }
        if (!slot) continue;
        const early = slot.scheduledAt - CUTOFF;
        probes.push([teamId, early - 1, early - 1], [teamId, early, early]);
        const anchor = anchorOf(meet, l.starts, slot.mat);
        if (anchor) {
          const gap = l.starts.get(anchor.teamId)! + MIN_GAP;
          probes.push([teamId, gap - 1, gap - 1], [teamId, gap, gap], [teamId, gap - 1, gap + MAX_AGE]);
        }
        const c = l.crowdC.get(teamId);
        if (c !== undefined) {
          // Rule 5 is judged at server time; rules 1-4 at the (backdated) tap time.
          const late = c + LATE_TAPS;
          probes.push([teamId, late, late], [teamId, late + 1, late + 1], [teamId, late + 1 - MAX_AGE, late + 1]);
        }
      }
      const rows = await db.sql<{ reason: string | null }>(
        `select judgey_private.tap_rejection($1, x.team, x.at, x.now) as reason
         from unnest($2::text[], $3::bigint[], $4::bigint[]) with ordinality x(team, at, now, k) order by x.k`,
        [meet.id, probes.map((p) => p[0]), probes.map((p) => p[1]), probes.map((p) => p[2])],
      );
      probes.forEach(([teamId, at, now], k) => {
        const expected = expectedTap(l, teamId, at, now);
        assert.equal(rows[k].reason, expected, `${label}: ${teamId} tapped at ${at}, judged at ${now}`);
        reasons.set(expected ?? "ok", (reasons.get(expected ?? "ok") ?? 0) + 1);
      });
    }
    t.diagnostic(`coverage ${JSON.stringify(Object.fromEntries(reasons))}`);
    const all = ["ok", "unknown-team", "scratched", "too-early", "not-next", "too-soon", "already-confirmed"];
    for (const reason of all) {
      assert.ok(reasons.has(reason), `tap reason ${reason} exercised (${JSON.stringify([...reasons])})`);
    }
  });
});
